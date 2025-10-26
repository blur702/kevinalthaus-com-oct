import express from 'express';
import multer from 'multer';
import path from 'path';
import { promises as fs, mkdirSync } from 'fs';
import { createHash, createVerify, randomBytes } from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import { authMiddleware } from '../auth';
import { requireRole } from '../auth/rbac-middleware';
import { Role, sanitizeFilename, createLogger, LogLevel } from '@monorepo/shared';
import { pluginManager } from '../plugins/manager';
import { createValidator } from '@monorepo/shared';
import { PLUGIN_MANIFEST_SCHEMA } from '@monorepo/shared';
import type { PluginManifest } from '@monorepo/shared';
import { asyncHandler } from '../utils/asyncHandler';

export const pluginsRouter = express.Router();

// Plugin ID validation pattern (same as adminPlugins)
const VALID_PLUGIN_ID_PATTERN = /^[a-z0-9-_]+$/;

/**
 * Validate plugin ID format
 * @returns true if valid, false if invalid
 */
function validatePluginId(pluginId: string): boolean {
  return VALID_PLUGIN_ID_PATTERN.test(pluginId);
}

// Logger for plugin routes
const logger = createLogger({
  level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
  service: 'main-app',
  format: (process.env.LOG_FORMAT as 'json' | 'text') || 'text',
});

// Require admin for all plugin management endpoints
pluginsRouter.use(authMiddleware, requireRole(Role.ADMIN));

pluginsRouter.get('/', (_req, res) => {
  try {
    const discovered = pluginManager.listDiscovered();
    const registry = pluginManager.listRegistry();
    const regMap = new Map(registry.map((r) => [r.id, r]));

    const items = discovered.map((d) => {
      const manifest = d.manifest;
      const id = manifest?.name ?? d.name;
      const reg = id ? regMap.get(id) : undefined;
      const status = reg?.status ?? 'inactive';
      return {
        id,
        name: manifest?.displayName ?? id,
        version: manifest?.version,
        description: manifest?.description,
        status,
      };
    });

    res.json({ plugins: items });
  } catch (error) {
    logger.error('Error listing plugins', undefined, { error });
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(500).json({
      error: 'Internal Server Error',
      message: isProduction ? 'An error occurred while listing plugins' : (error as Error).message,
    });
  }
});

// Archive validation helpers for plugin package uploads
const PLUGIN_UPLOAD_DIR = path.resolve(
  process.env.PLUGIN_UPLOAD_DIR || path.join(process.cwd(), 'data', 'plugin-uploads')
);

// Parse and validate plugin upload max size from environment
const parsedPluginMaxSize = parseInt(process.env.PLUGIN_UPLOAD_MAX_SIZE || '52428800', 10);
const PLUGIN_UPLOAD_MAX_SIZE =
  Number.isFinite(parsedPluginMaxSize) && parsedPluginMaxSize > 0
    ? parsedPluginMaxSize
    : 52428800; // Default 50MB

function ensureDirSync(dir: string): void {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    mkdirSync(dir, { recursive: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'EEXIST') {
      throw err;
    }
  }
}

// Accept common archive types for plugins
const ALLOWED_ARCHIVE_MIME = new Set<string>([
  'application/zip',
  'application/x-zip-compressed',
  'application/gzip',
  'application/x-gzip',
  'application/x-tar',
]);

// Configure dedicated multer instance for plugin packages
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      ensureDirSync(PLUGIN_UPLOAD_DIR);
      cb(null, PLUGIN_UPLOAD_DIR);
    } catch (err) {
      cb(err as Error, '');
    }
  },
  filename: (_req, file, cb) => {
    const base = path.basename(file.originalname, path.extname(file.originalname));
    const sanitized = sanitizeFilename(base);
    const ext = path.extname(file.originalname).toLowerCase();
    const rand = randomBytes(12).toString('hex');
    const finalName = `${rand}_${sanitized}${ext}`;
    cb(null, finalName);
  },
});

const uploadPackage = multer({
  storage,
  limits: { fileSize: PLUGIN_UPLOAD_MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    // Preliminary MIME check - reject clearly disallowed types early
    // Final validation via magic-byte sniffing happens after upload
    if (ALLOWED_ARCHIVE_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false); // Reject non-allowed MIME types
    }
  },
});

async function sniffMime(filePath: string): Promise<string | undefined> {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const fd = await fs.open(filePath, 'r');
    try {
      const { buffer } = await fd.read(Buffer.alloc(4100), 0, 4100, 0);
      const type = await fileTypeFromBuffer(buffer);
      return type?.mime;
    } finally {
      await fd.close();
    }
  } catch (err) {
    logger.warn('Failed to sniff MIME type', { error: err instanceof Error ? err.message : String(err) });
    return undefined;
  }
}

async function sha256File(filePath: string): Promise<string> {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const stream = (await import('fs')).createReadStream(filePath);
  const hash = createHash('sha256');
  return await new Promise<string>((resolve, reject) => {
    stream.on('data', (chunk: Buffer | string) => {
      if (typeof chunk === 'string') {
        hash.update(Buffer.from(chunk));
      } else {
        hash.update(chunk);
      }
    });
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function verifySignature(checksumHex: string, signatureBase64: string, publicKeyPem?: string): boolean {
  if (!publicKeyPem) {
    return false;
  }
  try {
    const verifier = createVerify('RSA-SHA256');
    verifier.update(checksumHex, 'utf8');
    verifier.end();
    const sig = Buffer.from(signatureBase64, 'base64');
    return verifier.verify(publicKeyPem, sig);
  } catch (err) {
    logger.warn('Signature verification failed', { error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

// Upload plugin package
pluginsRouter.post('/upload', uploadPackage.single('package'), asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Bad Request', message: 'No package file uploaded (field "package")' });
      return;
    }

    const filePath = (req.file as Express.Multer.File & { path?: string }).path || '';
    const detectedMime = await sniffMime(filePath);

    if (!detectedMime || !ALLOWED_ARCHIVE_MIME.has(detectedMime)) {
      try {
        if (filePath) {
          await fs.unlink(filePath);
        }
      } catch {
        /* ignore */
      }
      logger.warn('Invalid plugin package MIME type', { detectedMime, filePath });
      res.status(400).json({ error: 'Invalid file type', message: 'Uploaded file is not a supported archive format' });
      return;
    }

    // Optional: validate manifest JSON if provided as form field
    let manifest: PluginManifest | undefined;
    if (typeof req.body?.manifest === 'string') {
      try {
        const parse = JSON.parse(req.body.manifest) as PluginManifest;
        const validate = createValidator<PluginManifest>(PLUGIN_MANIFEST_SCHEMA);
        if (!validate(parse)) {
          try {
            if (filePath) {
              await fs.unlink(filePath);
            }
          } catch {
            /* ignore */
          }
          logger.warn('Plugin manifest validation failed', { errors: validate.errors });
          res.status(400).json({ error: 'Manifest validation failed', message: 'The plugin manifest does not meet the required schema' });
          return;
        }
        manifest = parse;
      } catch (err) {
        try {
          if (filePath) {
            await fs.unlink(filePath);
          }
        } catch {
          /* ignore */
        }
        logger.warn('Plugin manifest JSON parse error', { error: err });
        res.status(400).json({ error: 'Invalid manifest JSON', message: 'Failed to parse manifest JSON' });
        return;
      }
    }

    const checksum = await sha256File(filePath);

    // Optional signature verification
    const signature = typeof req.body?.signature === 'string' ? req.body.signature : undefined;
    const publicKeyPem = process.env.PLUGIN_SIGNATURE_PUBLIC_KEY;
    const signatureValid = signature ? verifySignature(checksum, signature, publicKeyPem) : false;

    res.status(201).json({
      message: 'Package uploaded',
      file: {
        filename: req.file.filename,
        size: req.file.size,
        mimetype: detectedMime,
      },
      checksum,
      signatureVerified: signature ? signatureValid : undefined,
      manifest,
    });
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file) {
      const filePath = (req.file as Express.Multer.File & { path?: string }).path;
      if (filePath) {
        try {
          await fs.unlink(filePath);
        } catch (unlinkErr) {
          logger.warn('Failed to delete uploaded file after error', { filePath, error: unlinkErr });
        }
      }
    }

    logger.error('Error uploading plugin package', undefined, { error });
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(500).json({
      error: 'Internal Server Error',
      message: isProduction ? 'An error occurred while uploading the package' : (error as Error).message,
    });
  }
}));

pluginsRouter.post('/:id/install', asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!validatePluginId(id)) {
    res.status(400).json({ error: 'Bad Request', message: 'Invalid plugin ID format' });
    return;
  }
  try {
    await pluginManager.install(id);
    res.status(200).json({ message: 'Installed', id });
  } catch (error) {
    logger.error('Plugin install failed', error as Error, { id });
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(500).json({
      error: 'PluginError',
      code: 'PLUGIN_INSTALL_FAILED',
      message: isProduction ? 'Failed to install plugin' : (error as Error).message,
    });
  }
}));

pluginsRouter.post('/:id/activate', asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!validatePluginId(id)) {
    res.status(400).json({ error: 'Bad Request', message: 'Invalid plugin ID format' });
    return;
  }
  try {
    await pluginManager.activate(id);
    res.status(200).json({ message: 'Activated', id });
  } catch (error) {
    logger.error('Plugin activate failed', error as Error, { id });
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(500).json({
      error: 'PluginError',
      code: 'PLUGIN_ACTIVATE_FAILED',
      message: isProduction ? 'Failed to activate plugin' : (error as Error).message,
    });
  }
}));

pluginsRouter.post('/:id/deactivate', asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!validatePluginId(id)) {
    res.status(400).json({ error: 'Bad Request', message: 'Invalid plugin ID format' });
    return;
  }
  try {
    await pluginManager.deactivate(id);
    res.status(200).json({ message: 'Deactivated', id });
  } catch (error) {
    logger.error('Plugin deactivate failed', error as Error, { id });
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(500).json({
      error: 'PluginError',
      code: 'PLUGIN_DEACTIVATE_FAILED',
      message: isProduction ? 'Failed to deactivate plugin' : (error as Error).message,
    });
  }
}));

pluginsRouter.post('/:id/uninstall', asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!validatePluginId(id)) {
    res.status(400).json({ error: 'Bad Request', message: 'Invalid plugin ID format' });
    return;
  }
  try {
    await pluginManager.uninstall(id);
    res.status(200).json({ message: 'Uninstalled', id });
  } catch (error) {
    logger.error('Plugin uninstall failed', error as Error, { id });
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(500).json({
      error: 'PluginError',
      code: 'PLUGIN_UNINSTALL_FAILED',
      message: isProduction ? 'Failed to uninstall plugin' : (error as Error).message,
    });
  }
}));

export default pluginsRouter;



