import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import { promises as fs, mkdirSync } from 'fs';
import { randomBytes } from 'crypto';
import { sanitizeFilename } from '@monorepo/shared';

// Validate upload max size from environment variables
const parsedMaxSize = parseInt(process.env.UPLOAD_MAX_SIZE || '10485760', 10);
const UPLOAD_MAX_SIZE =
  Number.isFinite(parsedMaxSize) && parsedMaxSize > 0 ? parsedMaxSize : 10485760; // Default 10MB

// Use absolute path for upload directory
const UPLOAD_DIRECTORY = path.resolve(
  process.env.UPLOAD_DIRECTORY || path.join(__dirname, '../../uploads')
);
// Quarantine directory for uploads before validation (TOCTOU mitigation)
const QUARANTINE_DIRECTORY = path.resolve(
  process.env.UPLOAD_QUARANTINE_DIR || path.join(__dirname, '../../uploads_quarantine')
);

const ALLOWED_FILE_TYPES = process.env.ALLOWED_FILE_TYPES
  ? process.env.ALLOWED_FILE_TYPES.split(',').map((type) => type.trim())
  : ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

// MIME type to file extension mapping
const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'application/json': ['.json'],
  'text/csv': ['.csv'],
};

// Generate allowed extensions from MIME types (strict - no derivation)
function generateAllowedExtensions(mimeTypes: string[]): Set<string> {
  const extensions = new Set<string>();

  for (const mimeType of mimeTypes) {
    const normalizedMime = mimeType.toLowerCase().trim();
    const exts = MIME_TO_EXTENSIONS[normalizedMime];

    if (exts) {
      // Use predefined mappings only
      exts.forEach((ext) => extensions.add(ext));
    } else {
      // Reject unknown MIME types - do not derive extensions for security
      throw new Error(
        `Unsupported MIME type: "${mimeType}". ` +
          `This MIME type is not in the predefined safe list. ` +
          `Supported MIME types are: ${Object.keys(MIME_TO_EXTENSIONS).join(', ')}. ` +
          `Please update MIME_TO_EXTENSIONS if you need to support this type.`
      );
    }
  }

  // If no MIME types configured, use safe defaults
  if (extensions.size === 0) {
    ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'].forEach((ext) => extensions.add(ext));
  }

  return extensions;
}

// Define allowed file extensions based on MIME types
const ALLOWED_EXTENSIONS = generateAllowedExtensions(ALLOWED_FILE_TYPES);

// Configure multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // Use synchronous operations to avoid async callback issues
    try {
      // Ensure quarantine directory; write uploaded files here first
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      mkdirSync(QUARANTINE_DIRECTORY, { recursive: true });
      cb(null, QUARANTINE_DIRECTORY);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (_req, file, cb) => {
    // Extract the file extension (validation happens in fileFilter)
    const originalExt = path.extname(file.originalname).toLowerCase();

    // Sanitize the original filename
    const baseName = path.basename(file.originalname, path.extname(file.originalname));
    const sanitizedBaseName = sanitizeFilename(baseName);

    // Use cryptographically secure random to avoid collisions
    const rand = randomBytes(12).toString('hex');
    const finalFilename = `${rand}_${sanitizedBaseName}${originalExt}`;

    cb(null, finalFilename);
  },
});

// MIME type validation function
const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    // Reject files with disallowed extensions before writing with a clear error
    const allowed = Array.from(ALLOWED_EXTENSIONS).join(', ');
    cb(new Error(`Disallowed file extension "${ext}" for file "${file.originalname}". Allowed extensions: ${allowed}`));
    return;
  }

  if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`));
  }
};

// Configure multer instance
export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: UPLOAD_MAX_SIZE,
  },
  fileFilter,
});

// Utility function to ensure upload directory exists
export async function ensureUploadDirectory(): Promise<void> {
  try {
    // UPLOAD_DIRECTORY is validated and resolved to absolute path at module initialization
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await fs.mkdir(UPLOAD_DIRECTORY, { recursive: true, mode: 0o700 });
    // Ensure quarantine directory exists with restrictive permissions where supported
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await fs.mkdir(QUARANTINE_DIRECTORY, { recursive: true, mode: 0o700 });
  } catch (error) {
    throw new Error(`Failed to create upload directory: ${(error as Error).message}`);
  }
}

/**
 * Express middleware to validate uploaded files using magic-byte sniffing
 * Use this after multer middleware to enforce file type validation
 *
 * Usage:
 *   router.post('/upload', uploadMiddleware.single('file'), validateUploadedFile, handler)
 *
 * On validation failure:
 * - Deletes the uploaded file
 * - Returns 400 with error details
 * - Does not call next(), preventing handler from running
 */
export async function validateUploadedFile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Check for single file upload (req.file)
    if (req.file) {
      const filePath = (req.file as Express.Multer.File & { path?: string }).path || '';
      const originalName = req.file.originalname;

      const validation = await sniffAndValidateFile(filePath, originalName);
      if (!validation.valid) {
        // Remove the stored file if invalid
        if (filePath) {
          try {
            await fs.unlink(filePath);
          } catch {
            /* ignore unlink errors */
          }
        }
        res.status(400).json({
          error: 'Invalid file content',
          details: validation.reason,
          detectedMime: validation.detectedMime,
        });
        return;
      }
    }

    // Check for multiple file uploads (req.files)
    if (req.files) {
      const files = Array.isArray(req.files)
        ? req.files
        : Object.values(req.files).flat();

      for (const file of files) {
        const filePath = (file as Express.Multer.File & { path?: string }).path || '';
        const originalName = file.originalname;

        const validation = await sniffAndValidateFile(filePath, originalName);
        if (!validation.valid) {
          // Remove ALL uploaded files if any one fails validation
          for (const f of files) {
            const fp = (f as Express.Multer.File & { path?: string }).path;
            if (fp) {
              try {
                await fs.unlink(fp);
              } catch {
                /* ignore */
              }
            }
          }
          res.status(400).json({
            error: 'Invalid file content',
            details: validation.reason,
            detectedMime: validation.detectedMime,
            filename: originalName,
          });
          return;
        }
      }
    }

    // All files valid: move from quarantine to final directory atomically
    // Single file
    if (req.file) {
      const quarantinePath = (req.file as Express.Multer.File & { path?: string }).path || '';
      if (quarantinePath) {
        const filename = path.basename(quarantinePath);
        const finalPath = path.join(UPLOAD_DIRECTORY, filename);
        try {
          // eslint-disable-next-line security/detect-non-literal-fs-filename
          await fs.rename(quarantinePath, finalPath);
        } catch (renameErr) {
          // Fallback: copy then unlink to handle cross-device moves
          try {
            await fs.copyFile(quarantinePath, finalPath);
            await fs.unlink(quarantinePath);
          } catch (fallbackErr) {
            // Attempt to cleanup quarantine file to avoid leftovers
            try { await fs.unlink(quarantinePath); } catch { /* ignore */ }
            throw new Error(`Failed to move uploaded file. file=${filename}, quarantinePath=${quarantinePath}, finalPath=${finalPath}, renameError=${(renameErr as Error).message}, fallbackError=${(fallbackErr as Error).message}`);
          }
        }
      }
    }
    // Multiple files
    if (req.files) {
      const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
      for (const f of files) {
        const quarantinePath = (f as Express.Multer.File & { path?: string }).path || '';
        if (quarantinePath) {
          const filename = path.basename(quarantinePath);
          const finalPath = path.join(UPLOAD_DIRECTORY, filename);
          try {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            await fs.rename(quarantinePath, finalPath);
          } catch (renameErr) {
            try {
              await fs.copyFile(quarantinePath, finalPath);
              await fs.unlink(quarantinePath);
            } catch (fallbackErr) {
              try { await fs.unlink(quarantinePath); } catch { /* ignore */ }
              throw new Error(`Failed to move uploaded file. file=${filename}, quarantinePath=${quarantinePath}, finalPath=${finalPath}, renameError=${(renameErr as Error).message}, fallbackError=${(fallbackErr as Error).message}`);
            }
          }
        }
      }
    }

    // Continue to next handler
    next();
  } catch (error) {
    // On unexpected error, try to clean up any uploaded files
    if (req.file) {
      const filePath = (req.file as Express.Multer.File & { path?: string }).path;
      if (filePath) {
        try {
          await fs.unlink(filePath);
        } catch {
          /* ignore */
        }
      }
    }
    if (req.files) {
      const files = Array.isArray(req.files)
        ? req.files
        : Object.values(req.files).flat();
      for (const f of files) {
        const fp = (f as Express.Multer.File & { path?: string }).path;
        if (fp) {
          try {
            await fs.unlink(fp);
          } catch {
            /* ignore */
          }
        }
      }
    }
    res.status(500).json({
      error: 'File validation failed',
      message: (error as Error).message,
    });
  }
}

// Magic-byte/content sniffing with dynamic import to support ESM-only dependency
export async function sniffAndValidateFile(
  filePath: string,
  originalName: string
): Promise<{ valid: boolean; detectedMime?: string; reason?: string }> {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const fd = await fs.open(filePath, 'r');
    try {
      const { buffer } = await fd.read(Buffer.alloc(4100), 0, 4100, 0);
      // Lazy import to avoid ESM/CommonJS interop issues at load time
      // Type assertion needed for dynamic import - file-type is ESM-only
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
      const fileTypeModule = await import('file-type');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const fileTypeFromBuffer = fileTypeModule.fileTypeFromBuffer;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
      const type = await fileTypeFromBuffer(buffer);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const detectedMime: string | undefined = type?.mime;

      const ext = path.extname(originalName).toLowerCase();

      // File type couldn't be detected - reject for safety
      if (!detectedMime) {
        return {
          valid: false,
          reason: 'Unable to detect file type from content. File may be corrupted or unsupported.',
        };
      }

      // Check if detected MIME type is in allowed list
      if (!ALLOWED_FILE_TYPES.includes(detectedMime)) {
        return {
          valid: false,
          detectedMime,
          reason: `Detected MIME type "${detectedMime}" is not in allowed types list`,
        };
      }

      // Verify extension matches detected content type
      const allowedExts = MIME_TO_EXTENSIONS[detectedMime];
      if (!allowedExts) {
        // MIME type is allowed but not in our mapping - this shouldn't happen due to strict resolution
        return {
          valid: false,
          detectedMime,
          reason: `Internal error: No extension mapping for MIME type "${detectedMime}"`,
        };
      }

      if (!allowedExts.includes(ext)) {
        return {
          valid: false,
          detectedMime,
          reason: `File extension "${ext}" does not match detected content type "${detectedMime}". Expected one of: ${allowedExts.join(', ')}`,
        };
      }

      return { valid: true, detectedMime };
    } finally {
      await fd.close();
    }
  } catch (err) {
    return { valid: false, reason: (err as Error).message };
  }
}
