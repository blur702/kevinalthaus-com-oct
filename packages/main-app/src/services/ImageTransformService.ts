/**
 * Image Transformation Service
 *
 * Provides on-the-fly image transformations using Sharp.
 * Supports resize, crop, format conversion, quality adjustment, and filters.
 * Includes caching to avoid re-processing the same transformations.
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { PluginLogger } from '@monorepo/shared';

export interface TransformOptions {
  // Resize options
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  // Crop options
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;

  // Format options
  format?: 'jpeg' | 'png' | 'webp' | 'avif' | 'gif';
  quality?: number; // 1-100

  // Filter options
  grayscale?: boolean;
  blur?: number; // 0.3-1000
  sharpen?: boolean;
  rotate?: number; // degrees
  flip?: boolean;
  flop?: boolean;

  // Advanced options
  stripMetadata?: boolean;
  withoutEnlargement?: boolean;
}

export interface TransformResult {
  buffer: Buffer;
  format: string;
  width: number;
  height: number;
  size: number;
  cacheKey: string;
}

export class ImageTransformService {
  private cacheDir: string;
  private logger: PluginLogger;
  private cacheEnabled: boolean;

  constructor(logger: PluginLogger, cacheDir = './storage/.cache/transforms') {
    this.logger = logger;
    this.cacheDir = cacheDir;
    this.cacheEnabled = true;
  }

  /**
   * Initialize cache directory
   */
  async initialize(): Promise<void> {
    if (this.cacheEnabled) {
      try {
        await fs.mkdir(this.cacheDir, { recursive: true });
        this.logger.info('Image transform cache initialized', { cacheDir: this.cacheDir });
      } catch (error) {
        this.logger.error('Failed to initialize transform cache', error as Error);
        this.cacheEnabled = false;
      }
    }
  }

  /**
   * Generate cache key from source path and transform options
   */
  private generateCacheKey(sourcePath: string, options: TransformOptions): string {
    const optionsStr = JSON.stringify(options, Object.keys(options).sort());
    const hash = crypto
      .createHash('sha256')
      .update(sourcePath + optionsStr)
      .digest('hex');
    return hash.substring(0, 32);
  }

  /**
   * Get cache file path
   */
  private getCachePath(cacheKey: string, format: string): string {
    // Organize cache by first 2 characters of key for better filesystem performance
    const subdir = cacheKey.substring(0, 2);
    return path.join(this.cacheDir, subdir, `${cacheKey}.${format}`);
  }

  /**
   * Check if transformed image exists in cache
   */
  private async getFromCache(cacheKey: string, format: string): Promise<Buffer | null> {
    if (!this.cacheEnabled) {
      return null;
    }

    try {
      const cachePath = this.getCachePath(cacheKey, format);
      const buffer = await fs.readFile(cachePath);
      this.logger.debug('Cache hit', { cacheKey });
      return buffer;
    } catch (error) {
      // Cache miss
      return null;
    }
  }

  /**
   * Save transformed image to cache
   */
  private async saveToCache(cacheKey: string, format: string, buffer: Buffer): Promise<void> {
    if (!this.cacheEnabled) {
      return;
    }

    try {
      const cachePath = this.getCachePath(cacheKey, format);
      const cacheDir = path.dirname(cachePath);

      // Ensure subdirectory exists
      await fs.mkdir(cacheDir, { recursive: true });

      // Write to temp file first, then rename for atomicity
      const tempPath = `${cachePath}.tmp`;
      await fs.writeFile(tempPath, buffer);
      await fs.rename(tempPath, cachePath);

      this.logger.debug('Saved to cache', { cacheKey, size: buffer.length });
    } catch (error) {
      this.logger.warn('Failed to save to cache', { error: (error as Error).message });
    }
  }

  /**
   * Transform an image with the specified options
   */
  async transform(sourcePath: string, options: TransformOptions): Promise<TransformResult> {
    const cacheKey = this.generateCacheKey(sourcePath, options);
    const outputFormat = options.format || 'jpeg';

    // Check cache first
    const cached = await this.getFromCache(cacheKey, outputFormat);
    if (cached) {
      const metadata = await sharp(cached).metadata();
      return {
        buffer: cached,
        format: outputFormat,
        width: metadata.width || 0,
        height: metadata.height || 0,
        size: cached.length,
        cacheKey,
      };
    }

    // Transform image
    try {
      let pipeline = sharp(sourcePath);

      // Apply crop first if specified
      if (options.cropX !== undefined && options.cropY !== undefined &&
          options.cropWidth !== undefined && options.cropHeight !== undefined) {
        pipeline = pipeline.extract({
          left: options.cropX,
          top: options.cropY,
          width: options.cropWidth,
          height: options.cropHeight,
        });
      }

      // Apply resize
      if (options.width || options.height) {
        pipeline = pipeline.resize(options.width, options.height, {
          fit: options.fit || 'cover',
          position: options.position || 'center',
          withoutEnlargement: options.withoutEnlargement !== false,
        });
      }

      // Apply rotation
      if (options.rotate) {
        pipeline = pipeline.rotate(options.rotate);
      }

      // Apply flip/flop
      if (options.flip) {
        pipeline = pipeline.flip();
      }
      if (options.flop) {
        pipeline = pipeline.flop();
      }

      // Apply filters
      if (options.grayscale) {
        pipeline = pipeline.grayscale();
      }
      if (options.blur) {
        pipeline = pipeline.blur(options.blur);
      }
      if (options.sharpen) {
        pipeline = pipeline.sharpen();
      }

      // Strip metadata if requested
      if (options.stripMetadata) {
        pipeline = pipeline.withMetadata({});
      }

      // Apply format and quality
      const quality = options.quality || 85;
      switch (outputFormat) {
        case 'jpeg':
          pipeline = pipeline.jpeg({ quality, progressive: true });
          break;
        case 'png':
          pipeline = pipeline.png({ quality, compressionLevel: 9 });
          break;
        case 'webp':
          pipeline = pipeline.webp({ quality });
          break;
        case 'avif':
          pipeline = pipeline.avif({ quality });
          break;
        case 'gif':
          pipeline = pipeline.gif();
          break;
      }

      const buffer = await pipeline.toBuffer();
      const metadata = await sharp(buffer).metadata();

      // Save to cache
      await this.saveToCache(cacheKey, outputFormat, buffer);

      this.logger.info('Image transformed', {
        cacheKey,
        width: metadata.width,
        height: metadata.height,
        format: outputFormat,
        size: buffer.length,
      });

      return {
        buffer,
        format: outputFormat,
        width: metadata.width || 0,
        height: metadata.height || 0,
        size: buffer.length,
        cacheKey,
      };
    } catch (error) {
      this.logger.error('Image transformation failed', error as Error, { sourcePath, options });
      throw new Error(`Image transformation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Parse transformation options from URL query parameters
   */
  parseQueryParams(query: Record<string, unknown>): TransformOptions {
    const options: TransformOptions = {};

    // Resize options
    if (query.width) {options.width = parseInt(String(query.width), 10);}
    if (query.height) {options.height = parseInt(String(query.height), 10);}
    if (query.fit) {options.fit = String(query.fit) as TransformOptions['fit'];}
    if (query.position) {options.position = String(query.position) as TransformOptions['position'];}

    // Crop options
    if (query.cropX) {options.cropX = parseInt(String(query.cropX), 10);}
    if (query.cropY) {options.cropY = parseInt(String(query.cropY), 10);}
    if (query.cropWidth) {options.cropWidth = parseInt(String(query.cropWidth), 10);}
    if (query.cropHeight) {options.cropHeight = parseInt(String(query.cropHeight), 10);}

    // Format options
    if (query.format) {options.format = String(query.format) as TransformOptions['format'];}
    if (query.quality) {options.quality = parseInt(String(query.quality), 10);}

    // Filter options
    if (query.grayscale === 'true' || query.grayscale === '1') {options.grayscale = true;}
    if (query.blur) {options.blur = parseFloat(String(query.blur));}
    if (query.sharpen === 'true' || query.sharpen === '1') {options.sharpen = true;}
    if (query.rotate) {options.rotate = parseInt(String(query.rotate), 10);}
    if (query.flip === 'true' || query.flip === '1') {options.flip = true;}
    if (query.flop === 'true' || query.flop === '1') {options.flop = true;}

    // Advanced options
    if (query.stripMetadata === 'true' || query.stripMetadata === '1') {options.stripMetadata = true;}
    if (query.withoutEnlargement === 'false' || query.withoutEnlargement === '0') {options.withoutEnlargement = false;}

    return options;
  }

  /**
   * Validate transformation options
   */
  validateOptions(options: TransformOptions): { valid: boolean; error?: string } {
    // Validate dimensions
    if (options.width && (options.width < 1 || options.width > 4000)) {
      return { valid: false, error: 'Width must be between 1 and 4000' };
    }
    if (options.height && (options.height < 1 || options.height > 4000)) {
      return { valid: false, error: 'Height must be between 1 and 4000' };
    }

    // Validate quality
    if (options.quality && (options.quality < 1 || options.quality > 100)) {
      return { valid: false, error: 'Quality must be between 1 and 100' };
    }

    // Validate blur
    if (options.blur && (options.blur < 0.3 || options.blur > 1000)) {
      return { valid: false, error: 'Blur must be between 0.3 and 1000' };
    }

    // Validate rotation
    if (options.rotate && (options.rotate < -360 || options.rotate > 360)) {
      return { valid: false, error: 'Rotation must be between -360 and 360' };
    }

    // Validate crop dimensions
    if (options.cropWidth && options.cropWidth < 1) {
      return { valid: false, error: 'Crop width must be at least 1' };
    }
    if (options.cropHeight && options.cropHeight < 1) {
      return { valid: false, error: 'Crop height must be at least 1' };
    }

    return { valid: true };
  }

  /**
   * Clear transformation cache
   */
  async clearCache(): Promise<void> {
    if (!this.cacheEnabled) {
      return;
    }

    try {
      await fs.rm(this.cacheDir, { recursive: true, force: true });
      await fs.mkdir(this.cacheDir, { recursive: true });
      this.logger.info('Transform cache cleared');
    } catch (error) {
      this.logger.error('Failed to clear cache', error as Error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ files: number; totalSize: number }> {
    if (!this.cacheEnabled) {
      return { files: 0, totalSize: 0 };
    }

    try {
      let files = 0;
      let totalSize = 0;

      const scanDir = async (dir: string): Promise<void> => {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await scanDir(fullPath);
          } else if (entry.isFile()) {
            const stats = await fs.stat(fullPath);
            files++;
            totalSize += stats.size;
          }
        }
      };

      await scanDir(this.cacheDir);

      return { files, totalSize };
    } catch (error) {
      this.logger.error('Failed to get cache stats', error as Error);
      return { files: 0, totalSize: 0 };
    }
  }

  /**
   * Clean old cache files (LRU eviction)
   */
  async cleanOldCache(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    if (!this.cacheEnabled) {
      return 0;
    }

    try {
      let deletedCount = 0;
      const now = Date.now();

      const scanDir = async (dir: string): Promise<void> => {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await scanDir(fullPath);
          } else if (entry.isFile()) {
            const stats = await fs.stat(fullPath);
            const age = now - stats.mtimeMs;

            if (age > maxAge) {
              await fs.unlink(fullPath);
              deletedCount++;
            }
          }
        }
      };

      await scanDir(this.cacheDir);

      this.logger.info('Old cache files cleaned', { deletedCount });
      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to clean old cache', error as Error);
      return 0;
    }
  }
}
