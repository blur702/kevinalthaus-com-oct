import { Pool } from 'pg';
import { MediaService, type UploadedFile, type FileValidationResult } from '../mediaService';
import type { PluginLogger } from '@monorepo/shared';
import { promises as fs } from 'fs';
import sharp from 'sharp';
import fileType from 'file-type';

// Mock dependencies
jest.mock('pg');
jest.mock('file-type');
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    access: jest.fn(),
    stat: jest.fn(),
    rename: jest.fn(),
    copyFile: jest.fn(),
    unlink: jest.fn(),
  },
}));

// Mock sharp with chainable methods
const mockSharpInstance = {
  metadata: jest.fn(),
  resize: jest.fn(),
  png: jest.fn(),
  webp: jest.fn(),
  jpeg: jest.fn(),
  toFile: jest.fn(),
};

// Set up chaining
mockSharpInstance.resize.mockReturnValue(mockSharpInstance);
mockSharpInstance.png.mockReturnValue(mockSharpInstance);
mockSharpInstance.webp.mockReturnValue(mockSharpInstance);
mockSharpInstance.jpeg.mockReturnValue(mockSharpInstance);

jest.mock('sharp', () => jest.fn(() => mockSharpInstance));

describe('MediaService', () => {
  let service: MediaService;
  let mockPool: jest.Mocked<Pool>;
  let mockLogger: jest.Mocked<PluginLogger>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPool = {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
    } as unknown as jest.Mocked<Pool>;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as jest.Mocked<PluginLogger>;

    service = new MediaService(mockPool, mockLogger, './test-uploads');
  });

  describe('constructor', () => {
    it('should initialize with provided dependencies', () => {
      expect(service).toBeInstanceOf(MediaService);
    });
  });

  describe('init', () => {
    it('should create upload directory recursively', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

      await service.init();

      expect(fs.mkdir).toHaveBeenCalledWith('./test-uploads', { recursive: true });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Upload directory initialized: ./test-uploads'
      );
    });

    it('should throw error if directory creation fails', async () => {
      const error = new Error('Permission denied');
      (fs.mkdir as jest.Mock).mockRejectedValue(error);

      await expect(service.init()).rejects.toThrow('Permission denied');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize upload directory',
        error
      );
    });
  });

  describe('validateFile', () => {
    const mockFile = {
      fieldname: 'file',
      originalname: 'test.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      destination: './test-uploads',
      filename: 'test-123.jpg',
      path: './test-uploads/test-123.jpg',
      size: 1024 * 100, // 100KB
    };

    it('should validate a file with allowed extension and MIME type', async () => {
      (fs.stat as jest.Mock).mockResolvedValue({ isFile: () => true });
      (fileType.fromFile as jest.Mock).mockResolvedValue({
        mime: 'image/jpeg',
        ext: 'jpg',
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            mime_type: 'image/jpeg',
            file_extension: 'jpg',
            max_file_size: 1024 * 1024 * 5, // 5MB
          },
        ],
        rowCount: 1,
      } as any);

      const result = await service.validateFile(mockFile);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(fs.stat).toHaveBeenCalledWith(mockFile.path);
      expect(fileType.fromFile).toHaveBeenCalledWith(mockFile.path);
    });

    it('should reject file with disallowed extension', async () => {
      (fs.stat as jest.Mock).mockResolvedValue({ isFile: () => true });
      (fileType.fromFile as jest.Mock).mockResolvedValue({
        mime: 'application/x-executable',
        ext: 'exe',
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      const result = await service.validateFile({
        ...mockFile,
        originalname: 'virus.exe',
        mimetype: 'application/x-executable',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should reject file exceeding max size', async () => {
      (fs.stat as jest.Mock).mockResolvedValue({ isFile: () => true });
      (fileType.fromFile as jest.Mock).mockResolvedValue({
        mime: 'image/jpeg',
        ext: 'jpg',
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            mime_type: 'image/jpeg',
            file_extension: 'jpg',
            max_file_size: 1024 * 50, // 50KB (smaller than file)
          },
        ],
        rowCount: 1,
      } as any);

      const result = await service.validateFile(mockFile);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds limit');
    });

    it('should reject file with mismatched MIME type', async () => {
      (fs.stat as jest.Mock).mockResolvedValue({ isFile: () => true });
      (fileType.fromFile as jest.Mock).mockResolvedValue({
        mime: 'application/x-executable', // Different from claimed
        ext: 'exe',
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      const result = await service.validateFile({
        ...mockFile,
        mimetype: 'image/jpeg', // Claimed to be image
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('processImage', () => {
    const mockFile = {
      fieldname: 'file',
      originalname: 'test.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      destination: './test-uploads',
      filename: 'test-123.jpg',
      path: './test-uploads/test-123.jpg',
      size: 1024 * 100,
    };

    it('should process and resize image', async () => {
      mockSharpInstance.metadata.mockResolvedValue({
        width: 2000,
        height: 1500,
        format: 'jpeg',
      });
      mockSharpInstance.toFile.mockResolvedValue({ size: 1024 * 80 });

      const result = await service.processImage(mockFile.path, { maxWidth: 1920 });

      expect(sharp).toHaveBeenCalledWith(mockFile.path);
      expect(mockSharpInstance.resize).toHaveBeenCalledWith(1920, 2000, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    });

    it('should handle atomic swap write (temp file then rename)', async () => {
      mockSharpInstance.metadata.mockResolvedValue({
        width: 1000,
        height: 800,
        format: 'jpeg',
      });
      mockSharpInstance.toFile.mockResolvedValue({ size: 1024 * 50 });
      (fs.rename as jest.Mock).mockResolvedValue(undefined);

      await service.processImage(mockFile.path, { quality: 90 });

      expect(mockSharpInstance.toFile).toHaveBeenCalled();
      const processedPath = (mockSharpInstance.toFile as jest.Mock).mock.calls[0][0];
      expect(processedPath).toContain('_processed');
      expect(fs.rename).toHaveBeenCalledTimes(2); // backup and swap
    });

    it('should rollback temp file on failure', async () => {
      const error = new Error('Processing failed');
      mockSharpInstance.metadata.mockResolvedValue({ width: 1000, height: 800 });
      mockSharpInstance.toFile.mockRejectedValue(error);
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      await expect(service.processImage(mockFile.path)).rejects.toThrow(
        'Processing failed'
      );

      // Should attempt to remove temp file
      expect(fs.unlink).toHaveBeenCalled();
    });
  });

  describe('saveMediaMetadata', () => {
    const mockFile: UploadedFile = {
      fieldname: 'file',
      originalname: 'test.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      destination: './test-uploads',
      filename: 'test-123.jpg',
      path: './test-uploads/test-123.jpg',
      size: 102400,
    };

    const mockValidation: FileValidationResult = {
      valid: true,
      mimeType: 'image/jpeg',
      extension: 'jpg',
    };

    const userId = 'user-uuid-123';

    it('should insert media metadata into database', async () => {
      (fs.rename as jest.Mock).mockResolvedValue(undefined);
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 'media-uuid-123',
          filename: 'test-123.jpg',
          original_name: 'test.jpg',
          mime_type: 'image/jpeg',
          storage_path: expect.any(String),
        }],
        rowCount: 1,
      } as any);

      const result = await service.saveMediaMetadata(mockFile, mockValidation, userId);

      expect(result.id).toBe('media-uuid-123');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO plugin_content_manager.media'),
        expect.arrayContaining([userId, 'image/jpeg'])
      );
    });

    it('should handle cross-filesystem move with copy+unlink fallback', async () => {
      // First rename attempt fails with EXDEV
      const exdevError: NodeJS.ErrnoException = new Error('Cross-device link');
      exdevError.code = 'EXDEV';
      (fs.rename as jest.Mock).mockRejectedValueOnce(exdevError);

      // Fallback to copy+unlink
      (fs.copyFile as jest.Mock).mockResolvedValueOnce(undefined);
      (fs.unlink as jest.Mock).mockResolvedValueOnce(undefined);

      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 'media-uuid-456',
          filename: 'test-123.jpg',
          storage_path: expect.any(String),
        }],
        rowCount: 1,
      } as any);

      await service.saveMediaMetadata(mockFile, mockValidation, userId);

      expect(fs.rename).toHaveBeenCalled();
      expect(fs.copyFile).toHaveBeenCalledWith(mockFile.path, expect.any(String));
      expect(fs.unlink).toHaveBeenCalledWith(mockFile.path);
    });
  });

  describe('deleteMedia', () => {
    const mediaId = 'media-uuid-123';
    const userId = 'user-uuid-456';

    it('should soft-delete media record in database', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: mediaId,
            storage_path: './test-uploads/test-123.jpg',
            deleted_at: new Date(),
          },
        ],
        rowCount: 1,
      } as any);

      await service.deleteMedia(mediaId, userId);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE plugin_content_manager.media'),
        expect.arrayContaining([mediaId])
      );
    });

    it('should remove physical file', async () => {
      const storagePath = './test-uploads/test-123.jpg';
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: mediaId, storage_path: storagePath, deleted_at: new Date() }],
        rowCount: 1,
      } as any);
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      await service.deleteMedia(mediaId, userId);

      expect(fs.unlink).toHaveBeenCalledWith(storagePath);
    });

    it('should not throw if file already missing', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: mediaId, storage_path: './missing.jpg', deleted_at: new Date() }],
        rowCount: 1,
      } as any);

      const enoentError: NodeJS.ErrnoException = new Error('File not found');
      enoentError.code = 'ENOENT';
      (fs.unlink as jest.Mock).mockRejectedValue(enoentError);

      await expect(service.deleteMedia(mediaId, userId)).resolves.not.toThrow();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('already deleted'),
        expect.any(Object)
      );
    });
  });

  describe('getMedia', () => {
    const mediaId = 'media-uuid-123';

    it('should retrieve media metadata from database', async () => {
      const mockMedia = {
        id: mediaId,
        filename: 'test-123.jpg',
        original_name: 'test.jpg',
        mime_type: 'image/jpeg',
        file_size: 102400,
        created_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockMedia],
        rowCount: 1,
      } as any);

      const result = await service.getMedia(mediaId);

      expect(result).toEqual(mockMedia);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [mediaId]
      );
    });

    it('should return null for non-existent media', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      const result = await service.getMedia('non-existent-id');

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      mockPool.query.mockRejectedValue(dbError);

      await expect(service.getMedia(mediaId)).rejects.toThrow(
        'Database connection failed'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch media'),
        dbError
      );
    });
  });
});
