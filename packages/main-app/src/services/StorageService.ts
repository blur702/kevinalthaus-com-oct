/**
 * Storage Service Implementation
 *
 * Provides file system operations for reading, writing, and managing files.
 * Handles file uploads, downloads, and directory management with safety checks.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import type { IFileStorageService, StorageMetadata } from '@monorepo/shared';
import { sanitizeFilename } from '@monorepo/shared';

/**
 * Storage Service
 * Manages file system operations with security and validation
 */
export class StorageService implements IFileStorageService {
  public readonly name = 'storage';
  private initialized = false;
  private baseDir: string;

  constructor(baseDir: string = './storage') {
    this.baseDir = path.resolve(baseDir);
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

  async deleteFile(filePath: string): Promise<void> {
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

  async listFiles(dirPath: string): Promise<string[]> {
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

  // Helper methods

  private resolvePath(filePath: string): string {
    // Sanitize filename to prevent directory traversal
    const sanitized = sanitizeFilename(filePath);
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
