import multer from 'multer';
import path from 'path';
import { promises as fs, existsSync, mkdirSync } from 'fs';
import { sanitizeFilename } from '@monorepo/shared';

// Validate upload max size from environment variables
const parsedMaxSize = parseInt(process.env.UPLOAD_MAX_SIZE || '10485760', 10);
const UPLOAD_MAX_SIZE = (Number.isFinite(parsedMaxSize) && parsedMaxSize > 0) 
  ? parsedMaxSize 
  : 10485760; // Default 10MB

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
  // Add more mappings as needed
  'image/jpg': ['.jpg'],  // Some systems use this variant
  'text/plain': ['.txt'],
  'application/json': ['.json'],
  'text/csv': ['.csv'],
};

// Generate allowed extensions from MIME types
function generateAllowedExtensions(mimeTypes: string[]): Set<string> {
  const extensions = new Set<string>();
  
  for (const mimeType of mimeTypes) {
    const normalizedMime = mimeType.toLowerCase().trim();
    const exts = MIME_TO_EXTENSIONS[normalizedMime];
    
    if (exts) {
      // Use predefined mappings
      exts.forEach(ext => extensions.add(ext));
    } else {
      // Derive extension from MIME type subtype
      const parts = normalizedMime.split('/');
      if (parts.length === 2) {
        const subtype = parts[1];
        // Handle compound subtypes (e.g., 'vnd.ms-excel' -> 'excel')
        const extensionBase = subtype.split('.').pop() || subtype;
        const derivedExt = `.${extensionBase}`;
        extensions.add(derivedExt);
      } else {
        // Invalid MIME type format - fail fast with clear error
        throw new Error(
          `Invalid MIME type format: "${mimeType}". ` +
          `Expected format: "type/subtype" (e.g., "video/mp4", "image/jpeg"). ` +
          `Please check your ALLOWED_FILE_TYPES configuration.`
        );
      }
    }
  }
  
  // If no MIME types configured, use safe defaults
  if (extensions.size === 0) {
    ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'].forEach(ext => extensions.add(ext));
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
    // Extract and validate the file extension
    const originalExt = path.extname(file.originalname).toLowerCase();
    
    // Check if extension is in allowlist (derived from allowed MIME types)
    if (!ALLOWED_EXTENSIONS.has(originalExt)) {
      return cb(new Error(`File extension ${originalExt} not allowed. Allowed extensions (based on MIME types): ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`), '');
    }

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
  if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`
      )
    );
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
