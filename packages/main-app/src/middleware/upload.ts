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

// Define allowed file extensions
const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'
]);

// Configure multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // Use synchronous operations to avoid async callback issues
    try {
      // Check if directory exists
      if (!existsSync(UPLOAD_DIRECTORY)) {
        // Create directory if it doesn't exist
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
    
    // Check if extension is in allowlist
    if (!ALLOWED_EXTENSIONS.has(originalExt)) {
      return cb(new Error(`File extension ${originalExt} not allowed. Allowed extensions: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`), '');
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
    await fs.mkdir(UPLOAD_DIRECTORY, { recursive: true });
  } catch (error) {
    throw new Error(`Failed to create upload directory: ${(error as Error).message}`);
  }
}
