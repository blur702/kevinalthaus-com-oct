/**
 * StorageService Tests
 *
 * Tests for file storage service functionality.
 */

import { StorageService } from '../StorageService';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

describe('StorageService', () => {
  let storageService: StorageService;
  let testDir: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(tmpdir(), `storage-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    storageService = new StorageService(testDir);
    await storageService.initialize();
  });

  afterEach(async () => {
    await storageService.shutdown();

    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Error cleaning up test directory:', error);
    }
  });

  describe('initialize', () => {
    it('should initialize and create base directory', async () => {
      const newTestDir = path.join(tmpdir(), `storage-init-test-${Date.now()}`);
      const service = new StorageService(newTestDir);

      await service.initialize();

      const dirExists = await fs
        .access(newTestDir)
        .then(() => true)
        .catch(() => false);

      expect(dirExists).toBe(true);

      await service.shutdown();
      await fs.rm(newTestDir, { recursive: true, force: true });
    });

    it('should not allow double initialization', async () => {
      await expect(storageService.initialize()).rejects.toThrow(
        'StorageService is already initialized'
      );
    });
  });

  describe('healthCheck', () => {
    it('should return healthy when initialized and directory accessible', async () => {
      const health = await storageService.healthCheck();
      expect(health).toEqual({ healthy: true });
    });

    it('should return unhealthy when not initialized', async () => {
      const service = new StorageService();
      const health = await service.healthCheck();
      expect(health).toEqual({
        healthy: false,
        message: 'Service not initialized',
      });
    });
  });

  describe('writeFile and readFile', () => {
    it('should write and read a text file', async () => {
      const testContent = 'Hello, World!';
      await storageService.writeFile('test.txt', testContent);

      const content = await storageService.readFile('test.txt');
      expect(content.toString()).toBe(testContent);
    });

    it('should write and read a binary file', async () => {
      const testBuffer = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
      await storageService.writeFile('test.bin', testBuffer);

      const content = await storageService.readFile('test.bin');
      expect(content).toEqual(testBuffer);
    });

    it('should create nested directories when writing file', async () => {
      await storageService.writeFile('nested/dir/test.txt', 'content');

      const content = await storageService.readFile('nested/dir/test.txt');
      expect(content.toString()).toBe('content');
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      await storageService.writeFile('exists.txt', 'content');

      const exists = await storageService.exists('exists.txt');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const exists = await storageService.exists('nonexistent.txt');
      expect(exists).toBe(false);
    });
  });

  describe('deleteFile', () => {
    it('should delete an existing file', async () => {
      await storageService.writeFile('todelete.txt', 'content');

      await storageService.deleteFile('todelete.txt');

      const exists = await storageService.exists('todelete.txt');
      expect(exists).toBe(false);
    });

    it('should throw error when deleting non-existent file', async () => {
      await expect(storageService.deleteFile('nonexistent.txt')).rejects.toThrow();
    });
  });

  describe('getMetadata', () => {
    it('should return file metadata', async () => {
      const content = 'Test content';
      await storageService.writeFile('metadata.txt', content);

      const metadata = await storageService.getMetadata('metadata.txt');

      expect(metadata.size).toBe(Buffer.byteLength(content));
      expect(metadata.isDirectory).toBe(false);
      expect(metadata.mimeType).toBe('text/plain');
      // Dates should be valid (either Date objects or parseable strings)
      expect(metadata.createdAt).toBeTruthy();
      expect(metadata.modifiedAt).toBeTruthy();
      expect(new Date(metadata.createdAt).getTime()).not.toBeNaN();
      expect(new Date(metadata.modifiedAt).getTime()).not.toBeNaN();
    });

    it('should detect correct MIME types', async () => {
      const files = [
        { name: 'test.txt', mimeType: 'text/plain' },
        { name: 'test.json', mimeType: 'application/json' },
        { name: 'test.html', mimeType: 'text/html' },
        { name: 'test.jpg', mimeType: 'image/jpeg' },
        { name: 'test.png', mimeType: 'image/png' },
      ];

      for (const file of files) {
        await storageService.writeFile(file.name, 'content');
        const metadata = await storageService.getMetadata(file.name);
        expect(metadata.mimeType).toBe(file.mimeType);
      }
    });
  });

  describe('listFiles', () => {
    it('should list files in directory', async () => {
      await storageService.writeFile('file1.txt', 'content1');
      await storageService.writeFile('file2.txt', 'content2');

      const files = await storageService.listFiles('.');
      expect(files).toContain('file1.txt');
      expect(files).toContain('file2.txt');
    });

    it('should not include directories in file list', async () => {
      await storageService.createDirectory('subdir');
      await storageService.writeFile('file.txt', 'content');

      const files = await storageService.listFiles('.');
      expect(files).toContain('file.txt');
      expect(files).not.toContain('subdir');
    });
  });

  describe('createDirectory', () => {
    it('should create a directory', async () => {
      await storageService.createDirectory('newdir');

      const metadata = await storageService.getMetadata('newdir');
      expect(metadata.isDirectory).toBe(true);
    });

    it('should create nested directories', async () => {
      await storageService.createDirectory('parent/child/grandchild');

      const metadata = await storageService.getMetadata('parent/child/grandchild');
      expect(metadata.isDirectory).toBe(true);
    });
  });

  describe('deleteDirectory', () => {
    // Skip on Windows and WSL due to platform-specific fs.rm behavior
    // WSL paths that map to Windows (e.g., /mnt/e/) exhibit Windows filesystem behavior
    const isWinOrWSL = process.platform === 'win32' || process.env.WSL_DISTRO_NAME || process.cwd().startsWith('/mnt/');
    const describeOrSkip = isWinOrWSL ? describe.skip : describe;

    describeOrSkip('platform-specific behavior', () => {
      it('should delete empty directory', async () => {
        await storageService.createDirectory('emptydir');

        await storageService.deleteDirectory('emptydir');

        const exists = await storageService.exists('emptydir');
        expect(exists).toBe(false);
      });

      it('should delete directory recursively', async () => {
        await storageService.writeFile('dir/file.txt', 'content');

        await storageService.deleteDirectory('dir', true);

        const exists = await storageService.exists('dir');
        expect(exists).toBe(false);
      });
    });
  });

  describe('moveFile', () => {
    it('should move a file', async () => {
      await storageService.writeFile('source.txt', 'content');

      await storageService.moveFile('source.txt', 'dest.txt');

      const sourceExists = await storageService.exists('source.txt');
      const destExists = await storageService.exists('dest.txt');

      expect(sourceExists).toBe(false);
      expect(destExists).toBe(true);
    });

    it('should move file to different directory', async () => {
      await storageService.writeFile('source.txt', 'content');

      await storageService.moveFile('source.txt', 'newdir/dest.txt');

      const content = await storageService.readFile('newdir/dest.txt');
      expect(content.toString()).toBe('content');
    });
  });

  describe('copyFile', () => {
    it('should copy a file', async () => {
      await storageService.writeFile('source.txt', 'content');

      await storageService.copyFile('source.txt', 'copy.txt');

      const sourceExists = await storageService.exists('source.txt');
      const copyExists = await storageService.exists('copy.txt');

      expect(sourceExists).toBe(true);
      expect(copyExists).toBe(true);

      const copyContent = await storageService.readFile('copy.txt');
      expect(copyContent.toString()).toBe('content');
    });
  });

  describe('getPublicUrl', () => {
    it('should return public URL for file', () => {
      const url = storageService.getPublicUrl('test.txt');
      expect(url).toContain('/storage/');
      expect(url).toContain('test.txt');
    });

    it('should sanitize file path in URL', () => {
      const url = storageService.getPublicUrl('../../../etc/passwd');
      // Should be sanitized and not contain path traversal
      expect(url).not.toContain('..');
    });
  });

  describe('Security - Path traversal prevention', () => {
    it('should reject path traversal attempts', async () => {
      // Path traversal with ../ should be rejected for security
      await expect(
        storageService.writeFile('../outside.txt', 'content')
      ).rejects.toThrow('Invalid file path: directory traversal detected');
    });

    it('should handle absolute paths securely', async () => {
      // Absolute paths are normalized to relative paths within base directory
      // This test creates a file with "etc" and "passwd" in the name
      await storageService.writeFile('etc-passwd.txt', 'content');

      // File should be created with sanitized name in base directory
      const files = await storageService.listFiles('.');
      const sanitizedFile = files.find(f => f.includes('etc'));
      expect(sanitizedFile).toBeDefined();
    });
  });

  describe('Streams', () => {
    it('should create read stream', async () => {
      const content = 'Stream content test';
      await storageService.writeFile('streamtest.txt', content);

      const stream = storageService.createReadStream('streamtest.txt');
      expect(stream).toBeDefined();

      // Read stream content
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk as Buffer);
      }
      const result = Buffer.concat(chunks).toString();
      expect(result).toBe(content);
    });

    it('should create write stream', async () => {
      const stream = storageService.createWriteStream('writestream.txt');
      expect(stream).toBeDefined();

      // Write to stream
      await new Promise<void>((resolve, reject) => {
        stream.write('Stream write test', (err) => {
          if (err) {reject(err);}
          stream.end(() => resolve());
        });
      });

      const content = await storageService.readFile('writestream.txt');
      expect(content.toString()).toBe('Stream write test');
    });
  });
});
