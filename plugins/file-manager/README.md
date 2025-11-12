# File Manager Plugin

Comprehensive file management system with folder hierarchy, batch operations, advanced search, and granular access control.

## Status: Beta - Not Production Ready

**Critical TODOs before production use:**
- Physical file operations (copy/delete) are not implemented
- Folder permissions system exists in database but is not enforced
- Audit logging table exists but is not populated

See `TODO.md` for complete list of pending work.

## Features

- **Folder Hierarchy**: Create nested folder structures up to 10 levels deep
- **Batch Operations**: Move, copy, tag, and delete multiple files/folders at once
- **Access Control**: Granular permissions per folder with user and role-based access
- **File-Folder Association**: Files can exist in multiple folders (tag-like behavior)
- **Audit Trail**: Complete access logging for security and compliance
- **Soft Delete Support**: Safely delete files and folders with recovery options
- **Path Management**: Automatic path calculation and updates for nested structures
- **System Folders**: Protected folders that cannot be deleted

## Installation

The plugin is automatically installed via the plugin manager.

## API Endpoints

### Folder Management

- `GET /api/file-manager/folders` - List folders with hierarchy
- `GET /api/file-manager/folders/:id` - Get single folder with contents
- `POST /api/file-manager/folders` - Create new folder (Editor role)
- `PUT /api/file-manager/folders/:id` - Update folder metadata (Editor role)
- `DELETE /api/file-manager/folders/:id` - Delete folder (Admin only)
- `POST /api/file-manager/folders/:id/move` - Move folder to new parent (Editor role)

### File-Folder Association

- `POST /api/file-manager/files/:fileId/folder` - Add file to folder (Editor role)
- `DELETE /api/file-manager/files/:fileId/folder` - Remove file from folder (Editor role)

### Batch Operations

- `POST /api/file-manager/batch/move` - Move multiple files/folders (Editor role)
- `POST /api/file-manager/batch/copy` - Copy multiple files (Editor role)
- `POST /api/file-manager/batch/tag` - Tag multiple files (Editor role)
- `POST /api/file-manager/batch/delete` - Delete multiple files/folders (Admin only)

## Database Schema

The plugin creates the following tables in the `plugin_file_manager` schema:

- `folders` - Hierarchical folder structure
- `file_folders` - Junction table linking files to folders (many-to-many)
- `folder_permissions` - Granular access control per folder
- `file_access_log` - Audit trail for all file/folder access

### Enum Types

- `folder_type` - Type of folder (root, standard, system)
- `permission_type` - Permission level (read, write, delete, share, admin)
- `access_action` - Type of access action (view, download, upload, delete, share, permission_change)

## Usage Examples

### Creating a Folder

```typescript
POST /api/file-manager/folders
{
  "name": "Documents",
  "slug": "documents",
  "description": "Company documents",
  "parent_id": null,
  "color": "#4A90E2",
  "icon": "folder"
}
```

### Adding Files to a Folder

```typescript
POST /api/file-manager/files/{fileId}/folder
{
  "folder_id": "550e8400-e29b-41d4-a716-446655440000",
  "position": 1
}
```

### Batch Moving Files

```typescript
POST /api/file-manager/batch/move
{
  "file_ids": ["file-uuid-1", "file-uuid-2"],
  "folder_ids": ["folder-uuid-1"],
  "target_folder_id": "target-folder-uuid"
}
```

### Batch Tagging Files

```typescript
POST /api/file-manager/batch/tag
{
  "file_ids": ["file-uuid-1", "file-uuid-2"],
  "tags": ["important", "review"],
  "operation": "add"
}
```

## Configuration

The plugin uses the shared `public.files` table for file metadata. Folder structure is maintained independently, allowing files to exist in multiple folders or no folder at all.

### Folder Depth Limit

Maximum folder nesting depth is 10 levels (configurable via CHECK constraint in database).

### Permissions Model

Permissions are checked in the following order:
1. User-specific permissions (most specific)
2. Role-based permissions
3. Default admin permissions (admins always have full access)

Permissions can be set to inherit to child folders via the `inherit_to_children` flag.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development mode
npm run dev

# Run tests
npm test
```

## License

MIT
