# Plugin File Upload Guide

Complete guide for plugin developers to use the shared file storage service for uploading, managing, and serving files.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Plugin Integration](#plugin-integration)
5. [API Reference](#api-reference)
6. [Frontend Integration](#frontend-integration)
7. [Security & Best Practices](#security--best-practices)
8. [Examples](#examples)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The platform provides a centralized file storage service that handles:

- ✅ **File uploads** with validation (MIME type, size, magic bytes)
- ✅ **Image processing** (thumbnail generation, resizing, optimization)
- ✅ **Storage management** (plugin-scoped directories, soft delete)
- ✅ **RBAC integration** (capability-based access control)
- ✅ **Metadata tracking** (dimensions, alt text, captions, tags)
- ✅ **Audit trail** (uploaded by, deleted by, timestamps)

### Benefits for Plugin Developers

- **No Multer setup** - File handling is abstracted away
- **Automatic validation** - MIME type checking and file size limits
- **Built-in security** - Magic byte verification, path traversal protection
- **Image optimization** - Automatic resizing and thumbnail generation
- **Centralized management** - Admins can manage all files from one UI
- **RBAC enforcement** - Respects user roles and capabilities

---

## Architecture

### Directory Structure

Files are stored in a plugin-scoped hierarchy:

```
storage/
├── content-manager/
│   ├── 2025/
│   │   ├── 01/
│   │   │   ├── abc123-hero.jpg
│   │   │   ├── def456-thumbnail.png
│   │   │   └── ...
│   │   └── 02/
│   │       └── ...
│   └── ...
├── blog-plugin/
│   └── 2025/
│       └── 01/
│           └── ...
└── your-plugin/
    └── ...
```

### Database Schema

Files are tracked in `public.files`:

```sql
CREATE TABLE public.files (
  id UUID PRIMARY KEY,
  plugin_id VARCHAR(255) NOT NULL,       -- Plugin ownership
  filename VARCHAR(500) NOT NULL,        -- Generated unique filename
  original_name VARCHAR(500) NOT NULL,   -- Original upload name
  mime_type VARCHAR(255) NOT NULL,
  file_extension VARCHAR(50) NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,            -- Relative path from storage root
  storage_provider VARCHAR(100) NOT NULL DEFAULT 'local',

  -- Image metadata
  width INTEGER,
  height INTEGER,
  duration INTEGER,                      -- For video/audio

  -- SEO & accessibility
  alt_text VARCHAR(255),
  caption TEXT,
  tags JSONB,                            -- Array of tags

  -- Audit trail
  uploaded_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  deleted_by UUID REFERENCES public.users(id)
);
```

### Access Control

File operations require these capabilities:

- `FILE_VIEW` - List and view file metadata
- `FILE_UPLOAD` - Upload new files
- `FILE_DELETE` - Delete files (soft and hard delete)
- `FILE_MANAGE_TYPES` - Configure allowed file types (admin only)

---

## Quick Start

### 1. Declare File Capabilities

In your `plugin.yaml`:

```yaml
name: my-plugin
version: 1.0.0
capabilities:
  - database:read
  - database:write
  - file:upload    # Request file upload capability
  - file:view      # Request file view capability
  - file:delete    # Request file delete capability
```

### 2. Access Storage Service in Plugin Code

The storage service is injected into your plugin's execution context:

```typescript
// plugins/my-plugin/src/index.ts
import type { PluginExecutionContext } from '@monorepo/shared';

export async function uploadHandler(ctx: PluginExecutionContext) {
  const { storage, logger, user } = ctx;

  // Storage service is available via ctx.storage
  if (!storage) {
    logger.error('Storage service not available');
    return { success: false, error: 'Storage service not configured' };
  }

  // Use the storage service...
}
```

---

## Plugin Integration

### Accessing the Storage Service

The storage service is injected into `PluginExecutionContext`:

```typescript
export interface PluginExecutionContext {
  db: PoolClient;          // Database connection
  logger: PluginLogger;    // Structured logger
  config: PluginConfig;    // Plugin settings
  user?: User;             // Authenticated user (if available)
  storage?: IFileStorageService;  // File storage service
  email?: IEmailService;   // Email service
  blog?: IBlogService;     // Blog service
}
```

### Upload Example

```typescript
import type { PluginExecutionContext } from '@monorepo/shared';
import type { Request, Response } from 'express';

export async function uploadFileHandler(
  ctx: PluginExecutionContext,
  req: Request,
  res: Response
): Promise<void> {
  const { storage, logger, user } = ctx;

  if (!storage) {
    res.status(500).json({ error: 'Storage service unavailable' });
    return;
  }

  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Assuming you've used multer middleware to handle multipart/form-data
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No file provided' });
    return;
  }

  try {
    const result = await storage.uploadFile(
      'my-plugin',  // Your plugin ID
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      user.id,
      {
        generateThumbnail: true,   // Auto-generate thumbnail for images
        thumbnailWidth: 200,
        thumbnailHeight: 200,
        quality: 85,
      }
    );

    logger.info('File uploaded successfully', { fileId: result.id });

    res.status(201).json({
      success: true,
      file: result,
    });
  } catch (error) {
    logger.error('File upload failed', error as Error);
    res.status(500).json({ error: 'Upload failed' });
  }
}
```

---

## API Reference

### `IFileStorageService` Interface

```typescript
export interface IFileStorageService {
  // Upload file
  uploadFile(
    pluginId: string,
    file: FileInput,
    userId: string,
    options?: UploadOptions
  ): Promise<FileUploadResult>;

  // List files with filters
  listFiles(options: FileListOptions): Promise<FileListResult>;

  // Get single file metadata
  getFile(fileId: string, pluginId?: string): Promise<FileMetadata | null>;

  // Update file metadata (altText, caption, tags)
  updateFileMetadata(
    fileId: string,
    metadata: FileMetadataUpdate,
    userId: string
  ): Promise<FileMetadata>;

  // Soft delete file
  deleteFile(fileId: string, userId: string, pluginId?: string): Promise<void>;

  // Permanent delete file
  hardDeleteFile(fileId: string, userId: string): Promise<void>;

  // Get allowed file types
  getAllowedFileTypes(category?: string): Promise<AllowedFileType[]>;

  // Initialize storage (called automatically)
  initialize(): Promise<void>;
}
```

### Method Details

#### `uploadFile()`

Upload a file for your plugin.

**Parameters:**

```typescript
pluginId: string          // Your plugin ID (e.g., 'my-plugin')
file: FileInput           // File buffer and metadata
userId: string            // ID of user uploading the file
options?: UploadOptions   // Optional upload configuration
```

**FileInput:**

```typescript
interface FileInput {
  buffer: Buffer;         // File contents
  originalname: string;   // Original filename
  mimetype: string;       // MIME type
  size: number;           // File size in bytes
}
```

**UploadOptions:**

```typescript
interface UploadOptions {
  generateThumbnail?: boolean;    // Generate thumbnail for images
  thumbnailWidth?: number;        // Thumbnail width (default: 200)
  thumbnailHeight?: number;       // Thumbnail height (default: 200)
  quality?: number;               // Image quality 1-100 (default: 85)
}
```

**Returns:**

```typescript
interface FileUploadResult {
  id: string;              // File UUID
  filename: string;        // Generated filename
  originalName: string;    // Original filename
  mimeType: string;
  fileExtension: string;
  fileSize: number;
  storagePath: string;     // Relative path from storage root
  url: string;             // Public URL to access file
  width?: number;          // Image width (if image)
  height?: number;         // Image height (if image)
  thumbnailUrl?: string;   // Thumbnail URL (if generated)
}
```

**Example:**

```typescript
const result = await storage.uploadFile(
  'my-plugin',
  {
    buffer: fileBuffer,
    originalname: 'profile-pic.jpg',
    mimetype: 'image/jpeg',
    size: 245632,
  },
  user.id,
  {
    generateThumbnail: true,
    thumbnailWidth: 150,
    thumbnailHeight: 150,
  }
);

console.log('File uploaded:', result.id);
console.log('Access at:', result.url);
```

---

#### `listFiles()`

List files with filters and pagination.

**Parameters:**

```typescript
interface FileListOptions {
  pluginId?: string;          // Filter by plugin
  mimeType?: string;          // Filter by MIME type (e.g., 'image/')
  tags?: string[];            // Filter by tags
  limit?: number;             // Max results (default: 50)
  offset?: number;            // Skip N results (default: 0)
  orderBy?: 'created_at' | 'filename' | 'file_size';
  orderDirection?: 'asc' | 'desc';
  includeDeleted?: boolean;   // Include soft-deleted files
}
```

**Returns:**

```typescript
interface FileListResult {
  files: FileMetadata[];
  total: number;
  limit: number;
  offset: number;
}

interface FileMetadata {
  id: string;
  pluginId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileExtension: string;
  fileSize: number;
  storagePath: string;
  storageProvider: string;
  width?: number;
  height?: number;
  duration?: number;
  altText?: string;
  caption?: string;
  tags?: string[];
  uploadedBy: string;
  createdAt: string;
  deletedAt?: string;
  deletedBy?: string;
}
```

**Example:**

```typescript
// Get all images for your plugin
const images = await storage.listFiles({
  pluginId: 'my-plugin',
  mimeType: 'image/',
  limit: 20,
  offset: 0,
  orderBy: 'created_at',
  orderDirection: 'desc',
});

console.log(`Found ${images.total} images`);
for (const file of images.files) {
  console.log(`- ${file.filename} (${file.fileSize} bytes)`);
}
```

---

#### `getFile()`

Get file metadata by ID.

**Parameters:**

```typescript
fileId: string            // File UUID
pluginId?: string         // Optional: verify file belongs to plugin
```

**Returns:** `FileMetadata | null`

**Example:**

```typescript
const file = await storage.getFile('abc-123-def-456', 'my-plugin');
if (file) {
  console.log('File found:', file.filename);
  console.log('Uploaded:', new Date(file.createdAt));
} else {
  console.log('File not found or not owned by this plugin');
}
```

---

#### `updateFileMetadata()`

Update file metadata (alt text, caption, tags).

**Parameters:**

```typescript
fileId: string            // File UUID
metadata: FileMetadataUpdate
userId: string            // User making the update
```

**FileMetadataUpdate:**

```typescript
interface FileMetadataUpdate {
  altText?: string;         // Alt text for accessibility
  caption?: string;         // Caption or description
  tags?: string[];          // Array of tags
}
```

**Returns:** `FileMetadata` (updated file)

**Example:**

```typescript
const updated = await storage.updateFileMetadata(
  'abc-123-def-456',
  {
    altText: 'User profile picture',
    caption: 'Professional headshot taken in 2025',
    tags: ['profile', 'user', 'headshot'],
  },
  user.id
);

console.log('Metadata updated for:', updated.filename);
```

---

#### `deleteFile()`

Soft delete a file (marks as deleted, keeps metadata).

**Parameters:**

```typescript
fileId: string            // File UUID
userId: string            // User performing deletion
pluginId?: string         // Optional: verify file belongs to plugin
```

**Returns:** `void` (throws on error)

**Example:**

```typescript
try {
  await storage.deleteFile('abc-123-def-456', user.id, 'my-plugin');
  console.log('File soft-deleted successfully');
} catch (error) {
  console.error('Delete failed:', error);
}
```

---

#### `hardDeleteFile()`

Permanently delete a file (removes file and metadata).

**Parameters:**

```typescript
fileId: string            // File UUID
userId: string            // User performing deletion
```

**Returns:** `void` (throws on error)

**Example:**

```typescript
try {
  await storage.hardDeleteFile('abc-123-def-456', user.id);
  console.log('File permanently deleted');
} catch (error) {
  console.error('Hard delete failed:', error);
}
```

---

## Frontend Integration

### Admin File Management

Admins can manage all files through the admin UI at `/files`:

- Upload files for any plugin
- View file metadata and previews
- Filter by plugin, MIME type, tags
- Edit alt text, captions, and tags
- Soft delete or permanently delete files

### Plugin File API Endpoints

Plugins can use these endpoints to manage their own files:

```
GET    /api/plugins/:pluginId/files              - List plugin's files
GET    /api/plugins/:pluginId/files/:id          - Get file metadata
POST   /api/plugins/:pluginId/files              - Upload file
PATCH  /api/plugins/:pluginId/files/:id          - Update metadata
DELETE /api/plugins/:pluginId/files/:id          - Delete file
GET    /api/plugins/:pluginId/allowed-types      - Get allowed types
```

### Frontend Upload Example

```typescript
// Frontend code (React/TypeScript)
import axios from 'axios';

async function uploadFile(file: File, pluginId: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('pluginId', pluginId);
  formData.append('generateThumbnail', 'true');
  formData.append('thumbnailWidth', '200');
  formData.append('thumbnailHeight', '200');

  try {
    const response = await axios.post(
      `/api/plugins/${pluginId}/files`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    console.log('Upload success:', response.data);
    return response.data;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}
```

---

## Security & Best Practices

### 1. File Validation

All uploads are automatically validated:

- ✅ **MIME type checking** - Uses magic bytes (file header), not just file extension
- ✅ **File size limits** - Enforced per file type in `public.allowed_file_types`
- ✅ **Allowed types** - Only permitted MIME types can be uploaded
- ✅ **Path traversal protection** - Filenames are sanitized

### 2. RBAC Integration

Always check user capabilities before file operations:

```typescript
// In your route handler
if (!user.capabilities.includes('FILE_UPLOAD')) {
  res.status(403).json({ error: 'FILE_UPLOAD capability required' });
  return;
}
```

### 3. Plugin Isolation

Files are plugin-scoped:

- Each plugin can only access its own files (when using `pluginId` parameter)
- Admins can access all files via admin endpoints
- Storage paths are namespaced: `storage/{pluginId}/...`

### 4. Soft Delete Pattern

Use soft delete for recoverability:

```typescript
// Soft delete (recommended for user actions)
await storage.deleteFile(fileId, userId, pluginId);

// Hard delete (use only for cleanup/admin operations)
await storage.hardDeleteFile(fileId, userId);
```

### 5. Image Optimization

Enable automatic image optimization:

```typescript
await storage.uploadFile(
  pluginId,
  file,
  userId,
  {
    generateThumbnail: true,  // Creates thumbnail
    thumbnailWidth: 200,
    thumbnailHeight: 200,
    quality: 85,              // Balances quality vs file size
  }
);
```

### 6. Error Handling

Always wrap storage operations in try-catch:

```typescript
try {
  const result = await storage.uploadFile(...);
  // Success handling
} catch (error) {
  logger.error('Upload failed', error as Error);
  // Cleanup, notify user, etc.
}
```

### 7. Resource Cleanup

If upload fails mid-process, temporary files are automatically cleaned up by the storage service.

---

## Examples

### Example 1: Simple File Upload

```typescript
export async function uploadHandler(
  ctx: PluginExecutionContext,
  req: Request,
  res: Response
): Promise<void> {
  const { storage, logger, user } = ctx;

  if (!storage || !user) {
    res.status(500).json({ error: 'Service unavailable' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: 'No file provided' });
    return;
  }

  try {
    const result = await storage.uploadFile(
      'my-plugin',
      {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
      user.id
    );

    res.status(201).json({ success: true, file: result });
  } catch (error) {
    logger.error('Upload failed', error as Error);
    res.status(500).json({ error: 'Upload failed' });
  }
}
```

### Example 2: List Files with Pagination

```typescript
export async function listFilesHandler(
  ctx: PluginExecutionContext,
  req: Request,
  res: Response
): Promise<void> {
  const { storage, logger } = ctx;

  if (!storage) {
    res.status(500).json({ error: 'Storage service unavailable' });
    return;
  }

  const page = parseInt(String(req.query.page || '1'), 10);
  const limit = parseInt(String(req.query.limit || '20'), 10);
  const offset = (page - 1) * limit;

  try {
    const result = await storage.listFiles({
      pluginId: 'my-plugin',
      limit,
      offset,
      orderBy: 'created_at',
      orderDirection: 'desc',
    });

    res.json({
      success: true,
      files: result.files,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch (error) {
    logger.error('List files failed', error as Error);
    res.status(500).json({ error: 'Failed to list files' });
  }
}
```

### Example 3: Image Gallery with Thumbnails

```typescript
export async function getGalleryHandler(
  ctx: PluginExecutionContext,
  req: Request,
  res: Response
): Promise<void> {
  const { storage, logger } = ctx;

  if (!storage) {
    res.status(500).json({ error: 'Storage service unavailable' });
    return;
  }

  try {
    // Get all images for plugin
    const result = await storage.listFiles({
      pluginId: 'my-plugin',
      mimeType: 'image/',
      limit: 50,
      orderBy: 'created_at',
      orderDirection: 'desc',
    });

    // Transform to gallery format
    const gallery = result.files.map((file) => ({
      id: file.id,
      title: file.originalName,
      thumbnail: `/storage/${file.storagePath}`, // or use thumbnailUrl if generated
      fullSize: `/storage/${file.storagePath}`,
      altText: file.altText,
      caption: file.caption,
      width: file.width,
      height: file.height,
      uploadedAt: file.createdAt,
    }));

    res.json({ success: true, gallery });
  } catch (error) {
    logger.error('Gallery fetch failed', error as Error);
    res.status(500).json({ error: 'Failed to load gallery' });
  }
}
```

### Example 4: Update File Metadata

```typescript
export async function updateMetadataHandler(
  ctx: PluginExecutionContext,
  req: Request,
  res: Response
): Promise<void> {
  const { storage, logger, user } = ctx;

  if (!storage || !user) {
    res.status(500).json({ error: 'Service unavailable' });
    return;
  }

  const { fileId } = req.params;
  const { altText, caption, tags } = req.body;

  try {
    // Verify file belongs to plugin
    const file = await storage.getFile(fileId, 'my-plugin');
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    // Update metadata
    const updated = await storage.updateFileMetadata(
      fileId,
      { altText, caption, tags },
      user.id
    );

    res.json({ success: true, file: updated });
  } catch (error) {
    logger.error('Metadata update failed', error as Error);
    res.status(500).json({ error: 'Update failed' });
  }
}
```

---

## Troubleshooting

### Issue: "Storage service unavailable"

**Cause:** Storage service not injected into plugin context.

**Solution:**
1. Verify your plugin has requested file capabilities in `plugin.yaml`
2. Check that the storage service is initialized in `packages/main-app/src/server.ts`
3. Ensure `pluginManager.setServices()` includes the storage service

### Issue: "File type not allowed"

**Cause:** Uploaded file MIME type is not in `public.allowed_file_types`.

**Solution:**
1. Check allowed types with `storage.getAllowedFileTypes()`
2. Admin can add new types via admin UI at `/files`
3. Or manually insert into `public.allowed_file_types` table

### Issue: "File size exceeds limit"

**Cause:** File size exceeds `max_file_size` for the MIME type.

**Solution:**
1. Check max size with `storage.getAllowedFileTypes()`
2. Admin can update limits in `public.allowed_file_types` table
3. Or ask users to resize/compress files before upload

### Issue: "Permission denied"

**Cause:** User lacks required capability (FILE_UPLOAD, FILE_VIEW, etc.).

**Solution:**
1. Verify user has the capability: `user.capabilities.includes('FILE_UPLOAD')`
2. Admin can grant capabilities via role management
3. Update RBAC configuration in `packages/shared/src/security/rbac.ts`

### Issue: "Thumbnail generation failed"

**Cause:** Sharp library failed to process the image.

**Solution:**
1. Check image format is supported by Sharp (JPEG, PNG, WebP, GIF, SVG, TIFF)
2. Verify image is not corrupted
3. Check server logs for Sharp errors
4. File will still be uploaded, just without thumbnail

---

## Allowed File Types

Default allowed file types (configured in `public.allowed_file_types`):

### Images
- `image/jpeg` (.jpg, .jpeg) - 10MB limit
- `image/png` (.png) - 10MB limit
- `image/webp` (.webp) - 10MB limit
- `image/gif` (.gif) - 10MB limit
- `image/svg+xml` (.svg) - 2MB limit

### Documents
- `application/pdf` (.pdf) - 20MB limit
- `application/msword` (.doc) - 20MB limit
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx) - 20MB limit

### Video
- `video/mp4` (.mp4) - 100MB limit
- `video/webm` (.webm) - 100MB limit

### Audio
- `audio/mpeg` (.mp3) - 20MB limit
- `audio/wav` (.wav) - 20MB limit

Admins can add/remove types via the admin UI.

---

## Summary

The shared file storage service provides a robust, secure, and easy-to-use solution for plugin file management:

1. **Declare** file capabilities in `plugin.yaml`
2. **Access** storage service via `ctx.storage`
3. **Upload** files with automatic validation and processing
4. **Manage** files with RBAC-enforced operations
5. **Serve** files through secure URLs

For questions or issues, refer to the main documentation or contact the platform team.
