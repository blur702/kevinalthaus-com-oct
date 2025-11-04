/**
 * Media Service
 * Handles file upload, validation, and processing
 */

import { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fromFile } from 'file-type';
import mimeTypes from 'mime-types';
import type { PluginLogger } from '@monorepo/shared';

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  destination: string;
  filename: string;
  path: string;
  size: number;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: string;
  extension?: string;
  maxSize?: number;
}

export interface ProcessedMedia {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  file_extension: string;
  file_size: number;
  storage_path: string;
  media_type: string;
  width?: number;
  height?: number;
}

export class MediaService {
  private pool: Pool;
  private logger: PluginLogger;
  private uploadDir: string;

  constructor(pool: Pool, logger: PluginLogger, uploadDir = './uploads/content') {
    this.pool = pool;
    this.logger = logger;
    this.uploadDir = uploadDir;
  }

  /**
   * Initialize upload directory
   */
  async init(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      this.logger.info(`Upload directory initialized: ${this.uploadDir}`);
    } catch (error) {
      this.logger.error('Failed to initialize upload directory', error as Error);
      throw error;
    }
  }

  /**
   * Validate file against allowed file types
   */
  async validateFile(file: UploadedFile): Promise<FileValidationResult> {
    try {
      // Check file exists
      const stats = await fs.stat(file.path);
      if (!stats.isFile()) {
        return { valid: false, error: 'Not a valid file' };
      }

      // Detect actual MIME type using magic bytes
      const fileTypeResult = await fromFile(file.path);
      const detectedMimeType = fileTypeResult?.mime || file.mimetype;
      const detectedExtension = fileTypeResult?.ext || path.extname(file.originalname).slice(1);

      // Query allowed file types
      const allowedTypesResult = await this.pool.query<{
        mime_type: string;
        file_extension: string;
        max_file_size: number | null;
      }>(
        `SELECT mime_type, file_extension, max_file_size
         FROM plugin_content_manager.allowed_file_types
         WHERE is_enabled = true AND (mime_type = $1 OR file_extension = $2)`,
        [detectedMimeType, detectedExtension]
      );

      if (allowedTypesResult.rows.length === 0) {
        return {
          valid: false,
          error: `File type not allowed: ${detectedMimeType} (.${detectedExtension})`
        };
      }

      const allowedType = allowedTypesResult.rows[0];

      // Check file size if limit is set
      if (allowedType.max_file_size && file.size > allowedType.max_file_size) {
        const maxSizeMB = (allowedType.max_file_size / 1024 / 1024).toFixed(2);
        const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
        return {
          valid: false,
          error: `File size ${fileSizeMB}MB exceeds limit of ${maxSizeMB}MB`
        };
      }

      return {
        valid: true,
        mimeType: detectedMimeType,
        extension: detectedExtension,
        maxSize: allowedType.max_file_size || undefined
      };
    } catch (error) {
      this.logger.error('File validation failed', error as Error);
      return { valid: false, error: 'File validation failed' };
    }
  }

  /**
   * Process image file (resize, optimize)
   */
  async processImage(
    filePath: string,
    options?: { maxWidth?: number; maxHeight?: number; quality?: number }
  ): Promise<{ width: number; height: number; outputPath: string }> {
    const { maxWidth = 2000, maxHeight = 2000, quality = 85 } = options || {};

    try {
      const image = sharp(filePath);
      const metadata = await image.metadata();

      // Resize if needed
      let processedImage = image;
      if ((metadata.width && metadata.width > maxWidth) || (metadata.height && metadata.height > maxHeight)) {
        processedImage = image.resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Optimize based on format - preserve transparency
      const hasAlpha = metadata.hasAlpha || metadata.channels === 4;
      const format = metadata.format || 'jpeg';
      let outputPath: string;

      if (hasAlpha || format === 'png') {
        // Preserve transparency with PNG
        outputPath = filePath.replace(/\.[^.]+$/, '_processed.png');
        await processedImage
          .png({ quality, compressionLevel: 9 })
          .toFile(outputPath);
      } else if (format === 'webp') {
        // Preserve WebP format
        outputPath = filePath.replace(/\.[^.]+$/, '_processed.webp');
        await processedImage
          .webp({ quality })
          .toFile(outputPath);
      } else {
        // Use JPEG for photos without transparency
        outputPath = filePath.replace(/\.[^.]+$/, '_processed.jpg');
        await processedImage
          .jpeg({ quality, progressive: true })
          .toFile(outputPath);
      }

      // Atomic replace: backup original, rename processed, cleanup backup
      const backupPath = filePath + '.bak';
      let backupCreated = false;
      let swapCompleted = false;
      try {
        await fs.rename(filePath, backupPath);
        backupCreated = true;
        await fs.rename(outputPath, filePath);
        swapCompleted = true;
        await fs.unlink(backupPath);
      } catch (error) {
        // Only restore backup if swap did NOT complete but backup was created
        if (backupCreated && !swapCompleted) {
          try {
            await fs.rename(backupPath, filePath);
          } catch (restoreError) {
            this.logger.error('Failed to restore backup', restoreError as Error);
          }
        }
        // Cleanup processed file if it still exists
        try {
          await fs.access(outputPath);
          await fs.unlink(outputPath);
        } catch (cleanupError) {
          // Ignore cleanup errors (file may not exist)
        }
        throw error;
      }

      const finalMetadata = await sharp(filePath).metadata();

      return {
        width: finalMetadata.width || 0,
        height: finalMetadata.height || 0,
        outputPath: filePath
      };
    } catch (error) {
      this.logger.error('Image processing failed', error as Error);
      throw error;
    }
  }

  /**
   * Save media metadata to database
   */
  async saveMediaMetadata(
    file: UploadedFile,
    validation: FileValidationResult,
    userId: string,
    options?: {
      contentId?: string;
      altText?: string;
      caption?: string;
      width?: number;
      height?: number;
    }
  ): Promise<ProcessedMedia> {
    const mimeType = validation.mimeType || file.mimetype;
    const extension = validation.extension || path.extname(file.originalname).slice(1);

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const filename = `${timestamp}-${randomStr}.${extension}`;
    const storagePath = path.join(this.uploadDir, filename);

    // Move file to final location (handle cross-filesystem moves)
    try {
      await fs.rename(file.path, storagePath);
    } catch (error) {
      // Handle EXDEV error (cross-filesystem) by copy + delete
      if ((error as NodeJS.ErrnoException).code === 'EXDEV') {
        await fs.copyFile(file.path, storagePath);
        await fs.unlink(file.path);
      } else {
        this.logger.error('Failed to move file', error as Error, { from: file.path, to: storagePath });
        throw error;
      }
    }

    // Process image if it's an image
    let width = options?.width;
    let height = options?.height;

    if (mimeType.startsWith('image/')) {
      try {
        const processed = await this.processImage(storagePath);
        width = processed.width;
        height = processed.height;
      } catch (error) {
        this.logger.warn('Image processing failed, using original', { error: (error as Error).message });
      }
    }

    // Insert into database
    const result = await this.pool.query<ProcessedMedia>(
      `INSERT INTO plugin_content_manager.media (
        filename,
        original_name,
        mime_type,
        file_extension,
        file_size,
        storage_path,
        width,
        height,
        alt_text,
        caption,
        content_id,
        uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        filename,
        file.originalname,
        mimeType,
        extension,
        file.size,
        storagePath,
        width || null,
        height || null,
        options?.altText || null,
        options?.caption || null,
        options?.contentId || null,
        userId
      ]
    );

    this.logger.info(`Media saved: ${filename} (${file.size} bytes)`);

    return result.rows[0];
  }

  /**
   * Delete media file and metadata
   */
  async deleteMedia(mediaId: string, userId: string): Promise<boolean> {
    try {
      // Get media info
      const mediaResult = await this.pool.query<{ storage_path: string }>(
        'SELECT storage_path FROM plugin_content_manager.media WHERE id = $1 AND deleted_at IS NULL',
        [mediaId]
      );

      if (mediaResult.rows.length === 0) {
        return false;
      }

      const storagePath = mediaResult.rows[0].storage_path;

      // Soft delete in database
      await this.pool.query(
        `UPDATE plugin_content_manager.media
         SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $1
         WHERE id = $2`,
        [userId, mediaId]
      );

      // Delete physical file
      try {
        await fs.unlink(storagePath);
        this.logger.info(`Media file deleted: ${storagePath}`);
      } catch (error) {
        this.logger.warn(`Failed to delete physical file: ${storagePath}`, { error: (error as Error).message });
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to delete media', error as Error);
      throw error;
    }
  }

  /**
   * Get media by ID
   */
  async getMedia(mediaId: string): Promise<ProcessedMedia | null> {
    const result = await this.pool.query<ProcessedMedia>(
      'SELECT * FROM plugin_content_manager.media WHERE id = $1 AND deleted_at IS NULL',
      [mediaId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get file extension from MIME type
   */
  getExtensionFromMime(mimeType: string): string {
    return mimeTypes.extension(mimeType) || 'bin';
  }
}
