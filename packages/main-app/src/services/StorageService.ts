/**
 * Storage Service Implementation
 *
 * Provides file system operations for reading, writing, and managing files.
 * Handles file uploads, downloads, and directory management with safety checks.
 * Includes plugin-aware file upload service with database tracking.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import type { Pool } from 'pg';
import sharp from 'sharp';
import type {
  IFileStorageService,
  StorageMetadata,
  FileUploadResult,
  ImageProcessingOptions,
  FileMetadata,
  FileListOptions,
  FileListResult,
  AllowedFileType,
} from '@monorepo/shared';
import { sanitizeFilename, sanitizePathComponent } from '@monorepo/shared';

/**
 * Storage Service
 * Manages file system operations with security and validation
 */
export class StorageService implements IFileStorageService {
  public readonly name = 'storage';
  private initialized = false;
  private baseDir: string;
  private dbPool?: Pool;
  private uploadsDir: string;

  constructor(baseDir: string = './storage', dbPool?: Pool) {
    this.baseDir = path.resolve(baseDir);
    this.dbPool = dbPool;
    this.uploadsDir = path.join(this.baseDir, 'uploads');
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('StorageService is already initialized');
    }

    // Ensure base directory exists
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
      console.log(`[StorageService] ✓ Base directory: ${this.baseDir}`);
    } catch (error) {
      throw new Error(
        `Failed to create storage directory: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Ensure uploads directory exists
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
      console.log(`[StorageService] ✓ Uploads directory: ${this.uploadsDir}`);
    } catch (error) {
      throw new Error(
        `Failed to create uploads directory: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    this.initialized = true;
    console.log('[StorageService] ✓ Initialized');
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }
    this.initialized = false;
    console.log('[StorageService] ✓ Shut down');
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.initialized) {
      return { healthy: false, message: 'Service not initialized' };
    }

    // Check if base directory is accessible
    try {
      await fs.access(this.baseDir);
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        message: `Storage directory not accessible: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async readFile(filePath: string): Promise<Buffer> {
    if (!this.initialized) {
      throw new Error('StorageService not initialized');
    }

    const fullPath = this.resolvePath(filePath);
    return fs.readFile(fullPath);
  }

  async writeFile(filePath: string, data: Buffer | string): Promise<void> {
    if (!this.initialized) {
      throw new Error('StorageService not initialized');
    }

    const fullPath = this.resolvePath(filePath);

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(fullPath, data);
  }

  /**
   * Delete file from disk (low-level filesystem operation)
   * @deprecated Use deleteFile() or hardDeleteFile() for plugin-aware operations
   * @private
   */
  private async deleteFileFromDisk(filePath: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('StorageService not initialized');
    }

    const fullPath = this.resolvePath(filePath);
    await fs.unlink(fullPath);
  }

  async exists(filePath: string): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('StorageService not initialized');
    }

    const fullPath = this.resolvePath(filePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(filePath: string): Promise<StorageMetadata> {
    if (!this.initialized) {
      throw new Error('StorageService not initialized');
    }

    const fullPath = this.resolvePath(filePath);
    const stats = await fs.stat(fullPath);

    return {
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      isDirectory: stats.isDirectory(),
      mimeType: this.guessMimeType(filePath),
    };
  }

  /**
   * List files in directory (low-level filesystem operation)
   * @deprecated Use listFiles() for plugin-aware file listing
   * @private
   */
  private async listFilesInDirectory(dirPath: string): Promise<string[]> {
    if (!this.initialized) {
      throw new Error('StorageService not initialized');
    }

    const fullPath = this.resolvePath(dirPath);
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  }

  async createDirectory(dirPath: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('StorageService not initialized');
    }

    const fullPath = this.resolvePath(dirPath);
    await fs.mkdir(fullPath, { recursive: true });
  }

  async deleteDirectory(dirPath: string, recursive = false): Promise<void> {
    if (!this.initialized) {
      throw new Error('StorageService not initialized');
    }

    const fullPath = this.resolvePath(dirPath);
    await fs.rm(fullPath, { recursive, force: recursive });
  }

  async moveFile(sourcePath: string, destPath: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('StorageService not initialized');
    }

    const fullSourcePath = this.resolvePath(sourcePath);
    const fullDestPath = this.resolvePath(destPath);

    // Ensure destination directory exists
    const destDir = path.dirname(fullDestPath);
    await fs.mkdir(destDir, { recursive: true });

    await fs.rename(fullSourcePath, fullDestPath);
  }

  async copyFile(sourcePath: string, destPath: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('StorageService not initialized');
    }

    const fullSourcePath = this.resolvePath(sourcePath);
    const fullDestPath = this.resolvePath(destPath);

    // Ensure destination directory exists
    const destDir = path.dirname(fullDestPath);
    await fs.mkdir(destDir, { recursive: true });

    await fs.copyFile(fullSourcePath, fullDestPath);
  }

  getPublicUrl(filePath: string): string {
    // Sanitize the file path
    const sanitized = sanitizeFilename(filePath);
    // Return a URL path (implementation depends on your setup)
    return `/storage/${sanitized}`;
  }

  createReadStream(filePath: string): NodeJS.ReadableStream {
    if (!this.initialized) {
      throw new Error('StorageService not initialized');
    }

    const fullPath = this.resolvePath(filePath);
    return createReadStream(fullPath);
  }

  createWriteStream(filePath: string): NodeJS.WritableStream {
    if (!this.initialized) {
      throw new Error('StorageService not initialized');
    }

    const fullPath = this.resolvePath(filePath);

    // Ensure directory exists (sync for streams)
    const dir = path.dirname(fullPath);
    fs.mkdir(dir, { recursive: true }).catch(() => {
      // Ignore if already exists
    });

    return createWriteStream(fullPath);
  }

  // ============================================================================
  // Backward-compatible filesystem operations (for tests and simple use cases)
  // ============================================================================

  /**
   * Delete file from filesystem (simple operation without database tracking)
   * For plugin-aware deletion with database tracking, use the overloaded deleteFile(fileId, userId, pluginId)
   */
  async deleteFile(filePath: string): Promise<void>;
  async deleteFile(fileId: string, userId: string, pluginId?: string): Promise<void>;
  async deleteFile(filePathOrId: string, userId?: string, pluginId?: string): Promise<void> {
    // If userId is provided, this is the plugin-aware version
    if (userId !== undefined) {
      return this.deleteFilePluginAware(filePathOrId, userId, pluginId);
    }
    // Otherwise, simple filesystem delete
    return this.deleteFileFromDisk(filePathOrId);
  }

  /**
   * List files in directory (simple operation without database tracking)
   * For plugin-aware listing with database tracking, use listFiles(options)
   */
  async listFiles(dirPath: string): Promise<string[]>;
  async listFiles(options: FileListOptions): Promise<FileListResult>;
  async listFiles(dirPathOrOptions: string | FileListOptions): Promise<string[] | FileListResult> {
    // If it's an object, this is the plugin-aware version
    if (typeof dirPathOrOptions === 'object') {
      return this.listFilesPluginAware(dirPathOrOptions);
    }
    // Otherwise, simple filesystem list
    return this.listFilesInDirectory(dirPathOrOptions);
  }

  // ============================================================================
  // Plugin-aware file operations (with database tracking)
  // ============================================================================

  async uploadFile(
    pluginId: string,
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    userId: string,
    options?: ImageProcessingOptions
  ): Promise<FileUploadResult> {
    if (!this.initialized) {
      throw new Error('StorageService not initialized');
    }

    if (!this.dbPool) {
      throw new Error('Database pool not available');
    }

    // Validate file type
    const fileExtension = path.extname(file.originalname).toLowerCase().substring(1);
    const isAllowed = await this.validateFileType(file.mimetype, fileExtension);

    if (!isAllowed) {
      throw new Error(`File type not allowed: ${file.mimetype} (.${fileExtension})`);
    }

    // Generate safe filename
    const randomPrefix = crypto.randomBytes(8).toString('hex');
    const sanitized = sanitizeFilename(file.originalname);
    const filename = `${randomPrefix}-${sanitized}`;

    // Create plugin-scoped directory structure: uploads/{pluginId}/{year}/{month}/
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const pluginDir = path.join(this.uploadsDir, pluginId, year, month);
    await fs.mkdir(pluginDir, { recursive: true });

    const filePath = path.join(pluginDir, filename);
    const storagePath = path.join(pluginId, year, month, filename);

    // Write file to disk
    await fs.writeFile(filePath, file.buffer);

    // Process image if requested and file is an image
    let width: number | undefined;
    let height: number | undefined;
    let thumbnailUrl: string | undefined;

    if (file.mimetype.startsWith('image/') && options?.generateThumbnail) {
      try {
        const metadata = await sharp(file.buffer).metadata();
        width = metadata.width;
        height = metadata.height;

        // Generate thumbnail
        const thumbnailFilename = `${randomPrefix}-thumb-${sanitized}`;
        const thumbnailPath = path.join(pluginDir, thumbnailFilename);
        const thumbnailStoragePath = path.join(pluginId, year, month, thumbnailFilename);

        await sharp(file.buffer)
          .resize(
            options.thumbnailWidth || 300,
            options.thumbnailHeight || 300,
            { fit: 'inside' }
          )
          .jpeg({ quality: options.quality || 80 })
          .toFile(thumbnailPath);

        thumbnailUrl = `/uploads/${thumbnailStoragePath}`;
      } catch (error) {
        console.warn('[StorageService] Failed to process image:', error);
        // Continue without thumbnail
      }
    }

    // Insert file record into database
    const result = await this.dbPool.query(
      `INSERT INTO public.files (
        plugin_id, filename, original_name, mime_type, file_extension,
        file_size, storage_path, width, height, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`,
      [
        pluginId,
        filename,
        file.originalname,
        file.mimetype,
        fileExtension,
        file.size,
        storagePath,
        width,
        height,
        userId,
      ]
    );

    const fileId = result.rows[0].id;
    const url = `/uploads/${storagePath}`;

    return {
      id: fileId,
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileExtension,
      fileSize: file.size,
      storagePath,
      url,
      width,
      height,
      thumbnailUrl,
    };
  }

  /**
   * Bulk upload multiple files with transaction support
   * All files will be uploaded atomically - if any file fails, all uploads are rolled back
   */
  async bulkUploadFiles(
    pluginId: string,
    files: Array<{
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    }>,
    userId: string,
    options?: {
      generateThumbnails?: boolean;
      thumbnailWidth?: number;
      thumbnailHeight?: number;
      quality?: number;
      continueOnError?: boolean; // If true, skip failed files; if false, rollback all
    }
  ): Promise<{
    successful: FileUploadResult[];
    failed: Array<{ filename: string; error: string }>;
    total: number;
  }> {
    if (!this.initialized) {
      throw new Error('StorageService not initialized');
    }

    if (!this.dbPool) {
      throw new Error('Database pool not available');
    }

    if (files.length === 0) {
      return { successful: [], failed: [], total: 0 };
    }

    const successful: FileUploadResult[] = [];
    const failed: Array<{ filename: string; error: string }> = [];
    const uploadedFiles: string[] = []; // Track files written to disk for cleanup

    // Pre-validate all files before starting transaction
    const validations = await Promise.all(
      files.map(async (file) => {
        const fileExtension = path.extname(file.originalname).toLowerCase().substring(1);
        const isAllowed = await this.validateFileType(file.mimetype, fileExtension);
        return { file, fileExtension, isAllowed };
      })
    );

    // Start database transaction
    const client = await this.dbPool.connect();

    try {
      await client.query('BEGIN');

      // Create plugin directory structure
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const pluginDir = path.join(this.uploadsDir, pluginId, year, month);
      await fs.mkdir(pluginDir, { recursive: true });

      // Process each file
      for (const { file, fileExtension, isAllowed } of validations) {
        try {
          if (!isAllowed) {
            throw new Error(`File type not allowed: ${file.mimetype} (.${fileExtension})`);
          }

          // Generate safe filename
          const randomPrefix = crypto.randomBytes(8).toString('hex');
          const sanitized = sanitizeFilename(file.originalname);
          const filename = `${randomPrefix}-${sanitized}`;

          const filePath = path.join(pluginDir, filename);
          const storagePath = path.join(pluginId, year, month, filename);

          // Write file to disk
          await fs.writeFile(filePath, file.buffer);
          uploadedFiles.push(filePath);

          // Process image if requested and file is an image
          let width: number | undefined;
          let height: number | undefined;
          let thumbnailUrl: string | undefined;

          if (file.mimetype.startsWith('image/') && options?.generateThumbnails) {
            try {
              const metadata = await sharp(file.buffer).metadata();
              width = metadata.width;
              height = metadata.height;

              // Generate thumbnail
              const thumbnailFilename = `${randomPrefix}-thumb-${sanitized}`;
              const thumbnailPath = path.join(pluginDir, thumbnailFilename);
              const thumbnailStoragePath = path.join(pluginId, year, month, thumbnailFilename);

              await sharp(file.buffer)
                .resize(
                  options.thumbnailWidth || 300,
                  options.thumbnailHeight || 300,
                  { fit: 'inside' }
                )
                .jpeg({ quality: options.quality || 80 })
                .toFile(thumbnailPath);

              uploadedFiles.push(thumbnailPath);
              thumbnailUrl = `/uploads/${thumbnailStoragePath}`;
            } catch (error) {
              console.warn('[StorageService] Failed to process image in bulk upload:', error);
              // Continue without thumbnail
            }
          }

          // Insert file record into database (within transaction)
          const result = await client.query(
            `INSERT INTO public.files (
              plugin_id, filename, original_name, mime_type, file_extension,
              file_size, storage_path, width, height, uploaded_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id`,
            [
              pluginId,
              filename,
              file.originalname,
              file.mimetype,
              fileExtension,
              file.size,
              storagePath,
              width,
              height,
              userId,
            ]
          );

          const fileId = result.rows[0].id;
          const url = `/uploads/${storagePath}`;

          successful.push({
            id: fileId,
            filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            fileExtension,
            fileSize: file.size,
            storagePath,
            url,
            width,
            height,
            thumbnailUrl,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          failed.push({
            filename: file.originalname,
            error: errorMessage,
          });

          // If continueOnError is false, throw to rollback transaction
          if (!options?.continueOnError) {
            throw new Error(
              `Bulk upload failed for ${file.originalname}: ${errorMessage}. Rolling back all uploads.`
            );
          }
        }
      }

      // Commit transaction if we got here
      await client.query('COMMIT');

      console.log(
        `[StorageService] Bulk upload complete: ${successful.length} successful, ${failed.length} failed`
      );

      return {
        successful,
        failed,
        total: files.length,
      };
    } catch (error) {
      // Rollback transaction on error
      await client.query('ROLLBACK');

      // Clean up any files written to disk
      await Promise.all(
        uploadedFiles.map(async (filePath) => {
          try {
            await fs.unlink(filePath);
          } catch (unlinkError) {
            console.warn('[StorageService] Failed to clean up file during rollback:', unlinkError);
          }
        })
      );

      throw error;
    } finally {
      client.release();
    }
  }

  async getFile(fileId: string, pluginId?: string): Promise<FileMetadata | null> {
    if (!this.initialized) {
      throw new Error('StorageService not initialized');
    }

    if (!this.dbPool) {
      throw new Error('Database pool not available');
    }

    let query = `
      SELECT
        id, plugin_id, filename, original_name, mime_type, file_extension,
        file_size, storage_path, storage_provider, width, height, duration,
        alt_text, caption, tags, uploaded_by, created_at, deleted_at, deleted_by
      FROM public.files
      WHERE id = $1
    `;
    const params: unknown[] = [fileId];

    if (pluginId) {
      query += ' AND plugin_id = $2';
      params.push(pluginId);
    }

    const result = await this.dbPool.query(query, params);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      pluginId: row.plugin_id,
      filename: row.filename,
      originalName: row.original_name,
      mimeType: row.mime_type,
      fileExtension: row.file_extension,
      fileSize: parseInt(row.file_size, 10),
      storagePath: row.storage_path,
      storageProvider: row.storage_provider,
      width: row.width,
      height: row.height,
      duration: row.duration,
      altText: row.alt_text,
      caption: row.caption,
      tags: row.tags,
      uploadedBy: row.uploaded_by,
      createdAt: row.created_at,
      deletedAt: row.deleted_at,
      deletedBy: row.deleted_by,
    };
  }

  private async listFilesPluginAware(options: FileListOptions): Promise<FileListResult> {
    if (!this.initialized) {
      throw new Error('StorageService not initialized');
    }

    if (!this.dbPool) {
      throw new Error('Database pool not available');
    }

    const params: unknown[] = [];
    let whereClause = 'WHERE 1=1';
    let paramIndex = 1;

    if (options.pluginId) {
      whereClause += ` AND plugin_id = $${paramIndex++}`;
      params.push(options.pluginId);
    }

    if (options.mimeType) {
      whereClause += ` AND mime_type = $${paramIndex++}`;
      params.push(options.mimeType);
    }

    if (options.tags && options.tags.length > 0) {
      whereClause += ` AND tags && $${paramIndex++}::text[]`;
      params.push(options.tags);
    }

    if (!options.includeDeleted) {
      whereClause += ' AND deleted_at IS NULL';
    }

    const orderBy = options.orderBy || 'created_at';
    const orderDirection = options.orderDirection || 'desc';
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM public.files ${whereClause}`;
    const countResult = await this.dbPool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // Get files
    const query = `
      SELECT
        id, plugin_id, filename, original_name, mime_type, file_extension,
        file_size, storage_path, storage_provider, width, height, duration,
        alt_text, caption, tags, uploaded_by, created_at, deleted_at, deleted_by
      FROM public.files
      ${whereClause}
      ORDER BY ${orderBy} ${orderDirection}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    const result = await this.dbPool.query(query, params);

    const files: FileMetadata[] = result.rows.map((row) => ({
      id: row.id,
      pluginId: row.plugin_id,
      filename: row.filename,
      originalName: row.original_name,
      mimeType: row.mime_type,
      fileExtension: row.file_extension,
      fileSize: parseInt(row.file_size, 10),
      storagePath: row.storage_path,
      storageProvider: row.storage_provider,
      width: row.width,
      height: row.height,
      duration: row.duration,
      altText: row.alt_text,
      caption: row.caption,
      tags: row.tags,
      uploadedBy: row.uploaded_by,
      createdAt: row.created_at,
      deletedAt: row.deleted_at,
      deletedBy: row.deleted_by,
    }));

    return {
      files,
      total,
      limit,
      offset,
    };
  }

  private async deleteFilePluginAware(fileId: string, userId: string, pluginId?: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('StorageService not initialized');
    }

    if (!this.dbPool) {
      throw new Error('Database pool not available');
    }

    // Soft delete: set deleted_at and deleted_by
    let query = `
      UPDATE public.files
      SET deleted_at = NOW(), deleted_by = $2
      WHERE id = $1
    `;
    const params: unknown[] = [fileId, userId];

    if (pluginId) {
      query += ' AND plugin_id = $3';
      params.push(pluginId);
    }

    const result = await this.dbPool.query(query, params);

    if (result.rowCount === 0) {
      throw new Error('File not found or already deleted');
    }
  }

  async hardDeleteFile(fileId: string, _userId: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('StorageService not initialized');
    }

    if (!this.dbPool) {
      throw new Error('Database pool not available');
    }

    // Get file metadata before deleting
    const file = await this.getFile(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    // Delete file from disk
    const fullPath = path.join(this.uploadsDir, file.storagePath);
    try {
      await fs.unlink(fullPath);
    } catch (error) {
      console.warn('[StorageService] Failed to delete file from disk:', error);
      // Continue to delete database record even if file is missing
    }

    // Delete from database
    await this.dbPool.query('DELETE FROM public.files WHERE id = $1', [fileId]);
  }

  async validateFileType(mimeType: string, fileExtension: string): Promise<boolean> {
    if (!this.dbPool) {
      throw new Error('Database pool not available');
    }

    const result = await this.dbPool.query(
      `SELECT id FROM public.allowed_file_types
       WHERE mime_type = $1 AND file_extension = $2 AND is_enabled = true`,
      [mimeType, fileExtension]
    );

    return result.rows.length > 0;
  }

  async getFileUrl(fileId: string): Promise<string> {
    const file = await this.getFile(fileId);
    if (!file) {
      throw new Error('File not found');
    }
    return `/uploads/${file.storagePath}`;
  }

  async getAllowedFileTypes(category?: string): Promise<AllowedFileType[]> {
    if (!this.dbPool) {
      throw new Error('Database pool not available');
    }

    let query = `
      SELECT id, mime_type, file_extension, category, description, max_file_size, is_enabled
      FROM public.allowed_file_types
      WHERE is_enabled = true
    `;
    const params: unknown[] = [];

    if (category) {
      query += ' AND category = $1';
      params.push(category);
    }

    query += ' ORDER BY category, file_extension';

    const result = await this.dbPool.query(query, params);

    return result.rows.map((row) => ({
      id: row.id,
      mimeType: row.mime_type,
      fileExtension: row.file_extension,
      category: row.category,
      description: row.description,
      maxFileSize: row.max_file_size ? parseInt(row.max_file_size, 10) : undefined,
      isEnabled: row.is_enabled,
    }));
  }

  async updateFileMetadata(
    fileId: string,
    metadata: {
      altText?: string;
      caption?: string;
      tags?: string[];
    },
    _userId: string
  ): Promise<FileMetadata> {
    if (!this.initialized) {
      throw new Error('StorageService not initialized');
    }

    if (!this.dbPool) {
      throw new Error('Database pool not available');
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (metadata.altText !== undefined) {
      updates.push(`alt_text = $${paramIndex++}`);
      params.push(metadata.altText);
    }

    if (metadata.caption !== undefined) {
      updates.push(`caption = $${paramIndex++}`);
      params.push(metadata.caption);
    }

    if (metadata.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      params.push(metadata.tags);
    }

    if (updates.length === 0) {
      // No updates, just return current file
      const file = await this.getFile(fileId);
      if (!file) {
        throw new Error('File not found');
      }
      return file;
    }

    params.push(fileId);

    const query = `
      UPDATE public.files
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id
    `;

    const result = await this.dbPool.query(query, params);

    if (result.rowCount === 0) {
      throw new Error('File not found');
    }

    const file = await this.getFile(fileId);
    if (!file) {
      throw new Error('File not found after update');
    }

    return file;
  }

  // Helper methods

  private resolvePath(filePath: string): string {
    // Normalize and sanitize path to prevent directory traversal
    // Split path into components, sanitize each, then rejoin
    const normalized = path.normalize(filePath);
    const parts = normalized.split(path.sep).filter(p => p && p !== '.');

    // Reject any path traversal attempts
    if (parts.some(part => part === '..')) {
      throw new Error('Invalid file path: directory traversal detected');
    }

    // Sanitize each path component
    // - For directory components: use sanitizePathComponent (no dots expected)
    // - For final component (filename): use sanitizeFilename (preserves extension)
    const sanitized = parts.map((part, index) => {
      const isLastPart = index === parts.length - 1;
      const hasExtension = part.includes('.');

      // Use sanitizeFilename for the last component if it has an extension
      if (isLastPart && hasExtension) {
        return sanitizeFilename(part);
      }

      // Use sanitizePathComponent for directory components
      return sanitizePathComponent(part);
    }).join(path.sep);

    const fullPath = path.resolve(this.baseDir, sanitized);

    // Ensure the resolved path is within base directory
    if (!fullPath.startsWith(this.baseDir)) {
      throw new Error('Invalid file path: directory traversal detected');
    }

    return fullPath;
  }

  private guessMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.zip': 'application/zip',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }
}
