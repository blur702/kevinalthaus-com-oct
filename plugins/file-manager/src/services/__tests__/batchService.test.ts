/**
 * Batch Service Tests
 * Tests for batch file/folder operations
 */

import { BatchService } from '../batchService';
import { Pool, PoolClient } from 'pg';
import type { PluginLogger } from '@monorepo/shared';
import type { StorageWrapper } from '../storageWrapper';

// Mock the dependencies
jest.mock('pg');
jest.mock('../storageWrapper');

describe('BatchService', () => {
  let batchService: BatchService;
  let mockPool: jest.Mocked<Pool>;
  let mockClient: jest.Mocked<PoolClient>;
  let mockLogger: jest.Mocked<PluginLogger>;
  let mockStorageService: jest.Mocked<StorageWrapper>;

  beforeEach(() => {
    // Create mock client with all required methods
    mockClient = {
      query: jest.fn() as any,
      release: jest.fn(),
    } as any;

    // Create mock pool
    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      query: jest.fn() as any,
    } as any;

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    // Create mock storage service
    mockStorageService = {
      copyFile: jest.fn().mockResolvedValue(undefined),
      hardDeleteFile: jest.fn().mockResolvedValue(undefined),
    } as any;

    batchService = new BatchService(mockPool, mockLogger, mockStorageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('batchMoveFiles', () => {
    const userId = 'user-123';
    const fileIds = ['file-1', 'file-2', 'file-3'];
    const targetFolderId = 'folder-123';

    it('should successfully move all files to target folder', async () => {
      // Mock BEGIN transaction
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      // Mock folder validation
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: targetFolderId }],
        rowCount: 1,
      } as any);

      // Mock file checks and operations for each file
      for (let i = 0; i < fileIds.length; i++) {
        // File exists check
        mockClient.query.mockResolvedValueOnce({
          rows: [{ id: fileIds[i] }],
          rowCount: 1,
        } as any);

        // Delete existing associations
        mockClient.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
        } as any);

        // Insert new association
        mockClient.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
        } as any);
      }

      // Mock COMMIT
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await batchService.batchMoveFiles(fileIds, targetFolderId, userId);

      expect(result.successful).toEqual(fileIds);
      expect(result.failed).toEqual([]);
      expect(result.total).toBe(fileIds.length);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Batch moved 3 files'));
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle moving files to root (null target)', async () => {
      // Mock BEGIN transaction
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      // For each file
      for (let i = 0; i < fileIds.length; i++) {
        // File exists check
        mockClient.query.mockResolvedValueOnce({
          rows: [{ id: fileIds[i] }],
          rowCount: 1,
        } as any);

        // Delete existing associations
        mockClient.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
        } as any);
      }

      // Mock COMMIT
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await batchService.batchMoveFiles(fileIds, null, userId);

      expect(result.successful).toEqual(fileIds);
      expect(result.failed).toEqual([]);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle non-existent files gracefully', async () => {
      // Mock BEGIN transaction
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      // Mock folder validation
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: targetFolderId }],
        rowCount: 1,
      } as any);

      // First file exists
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: fileIds[0] }],
        rowCount: 1,
      } as any);
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      // Second file doesn't exist
      mockClient.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      // Third file exists
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: fileIds[2] }],
        rowCount: 1,
      } as any);
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      // Mock COMMIT
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await batchService.batchMoveFiles(fileIds, targetFolderId, userId);

      expect(result.successful).toEqual([fileIds[0], fileIds[2]]);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]).toEqual({ id: fileIds[1], error: 'File not found' });
      expect(result.total).toBe(fileIds.length);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error if target folder not found', async () => {
      // Mock BEGIN transaction
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      // Mock folder validation failure
      mockClient.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      // Mock ROLLBACK
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      await expect(
        batchService.batchMoveFiles(fileIds, targetFolderId, userId)
      ).rejects.toThrow('Target folder not found');

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle individual file errors without rolling back transaction', async () => {
      // Mock BEGIN transaction
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      // Mock folder validation
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: targetFolderId }],
        rowCount: 1,
      } as any);

      // First file: check fails with error
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      // Second file: succeeds
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: fileIds[1] }],
        rowCount: 1,
      } as any);
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      // Third file: succeeds
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: fileIds[2] }],
        rowCount: 1,
      } as any);
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      // Mock COMMIT
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await batchService.batchMoveFiles(fileIds, targetFolderId, userId);

      expect(result.successful).toEqual([fileIds[1], fileIds[2]]);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]).toEqual({ id: fileIds[0], error: 'Database error' });
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle empty file list', async () => {
      // Mock BEGIN transaction
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      // Mock folder validation
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: targetFolderId }],
        rowCount: 1,
      } as any);

      // Mock COMMIT
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await batchService.batchMoveFiles([], targetFolderId, userId);

      expect(result.successful).toEqual([]);
      expect(result.failed).toEqual([]);
      expect(result.total).toBe(0);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('batchMoveFolders', () => {
    const userId = 'user-123';
    const folderIds = ['folder-1', 'folder-2'];
    const targetFolderId = 'target-folder';

    it('should successfully move all folders', async () => {
      // Mock BEGIN transaction
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      // Mock target folder validation
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: targetFolderId, depth: 2 }],
        rowCount: 1,
      } as any);

      // For each folder
      for (let i = 0; i < folderIds.length; i++) {
        // Folder exists check
        mockClient.query.mockResolvedValueOnce({
          rows: [{ id: folderIds[i], depth: 1 }],
          rowCount: 1,
        } as any);

        // Circular reference check (validateCircularReference)
        mockClient.query.mockResolvedValueOnce({
          rows: [{ is_circular: false }],
          rowCount: 1,
        } as any);

        // Update parent_id
        mockClient.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 1,
        } as any);
      }

      // Mock COMMIT
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await batchService.batchMoveFolders(folderIds, targetFolderId, userId);

      expect(result.successful).toEqual(folderIds);
      expect(result.failed).toEqual([]);
      expect(result.total).toBe(folderIds.length);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should reject moving folder to max depth', async () => {
      // Mock BEGIN transaction
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      // Mock target folder at max depth
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: targetFolderId, depth: 10 }],
        rowCount: 1,
      } as any);

      // Mock ROLLBACK
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      await expect(
        batchService.batchMoveFolders(folderIds, targetFolderId, userId)
      ).rejects.toThrow('Target folder is at maximum depth');

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle moving folders to root (null target)', async () => {
      // Mock BEGIN transaction
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      // For each folder
      for (let i = 0; i < folderIds.length; i++) {
        // Folder exists check
        mockClient.query.mockResolvedValueOnce({
          rows: [{ id: folderIds[i], depth: 1 }],
          rowCount: 1,
        } as any);

        // Update parent_id
        mockClient.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 1,
        } as any);
      }

      // Mock COMMIT
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await batchService.batchMoveFolders(folderIds, null, userId);

      expect(result.successful).toEqual(folderIds);
      expect(result.failed).toEqual([]);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
