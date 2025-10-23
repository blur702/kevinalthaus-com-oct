import multer from 'multer';
import path from 'path';
import { promises as fs, existsSync, mkdirSync } from 'fs';
import { sanitizeFilename } from '@monorepo/shared';

// Validate upload max size from environment variables
const parsedMaxSize = parseInt(process.env.UPLOAD_MAX_SIZE || '10485760', 10);
const UPLOAD_MAX_SIZE =
  Number.isFinite(parsedMaxSize) && parsedMaxSize > 0 ? parsedMaxSize : 10485760; // Default 10MB

// Use absolute path for upload directory
const UPLOAD_DIRECTORY = path.resolve(
  process.env.UPLOAD_DIRECTORY || path.join(__dirname, '../../uploads')
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
      // Check if directory exists
      // UPLOAD_DIRECTORY is validated and resolved to absolute path at module initialization
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (!existsSync(UPLOAD_DIRECTORY)) {
        // Create directory if it doesn't exist
        // UPLOAD_DIRECTORY is validated and resolved to absolute path at module initialization
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        mkdirSync(UPLOAD_DIRECTORY, { recursive: true });
      }
      cb(null, UPLOAD_DIRECTORY);
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

    // Add timestamp prefix to prevent filename collisions
    const timestamp = Date.now();
    const finalFilename = `${timestamp}_${sanitizedBaseName}${originalExt}`;

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
    // Reject files with disallowed extensions before writing
    cb(null, false);
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
    await fs.mkdir(UPLOAD_DIRECTORY, { recursive: true });
  } catch (error) {
    throw new Error(`Failed to create upload directory: ${(error as Error).message}`);
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
