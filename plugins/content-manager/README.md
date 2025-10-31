# Content Manager Plugin

A full-featured content management system plugin with rich text editing, media uploads, version history, scheduled publishing, and hierarchical taxonomies.

## Features

### Core Content Management
- **CRUD Operations**: Create, read, update, delete content with full validation
- **Draft/Published Workflow**: Content can be in draft, published, scheduled, or archived status
- **Scheduled Publishing**: Set future publish dates for automatic content publication
- **Version History**: Automatic versioning of all content changes with restore capability
- **Slug Management**: Automatic URL-friendly slug generation with uniqueness validation

### Rich Text Editing
- **TinyMCE Integration**: Modern WYSIWYG editor with extensive formatting options
- **Media Embedding**: Insert images and media directly from the media library
- **HTML Sanitization**: Secure HTML output with allowlist-based sanitization

### Media Management
- **File Uploads**: Support for images, documents, videos, audio, and archives
- **Configurable File Types**: Admin-configurable allowed file types and size limits
- **Image Optimization**: Automatic image processing with sharp library
- **File Validation**: Magic byte validation, MIME type checking, size limits
- **Media Library**: Browse, search, and manage uploaded files

### Taxonomy System
- **Hierarchical Categories**: Unlimited nesting with parent-child relationships
- **Flat Tags**: Simple tagging system for flexible content organization
- **Many-to-Many Relationships**: Content can have multiple categories and tags

### Security & Permissions
- **Role-Based Access Control**: Admin and Editor roles with different capabilities
  - **Editors**: Can create and edit drafts, view all content
  - **Admins**: Full control including publish, delete, configuration
- **Input Validation**: All inputs validated with Joi schemas
- **SQL Injection Prevention**: Parameterized queries throughout
- **CSRF Protection**: Double-submit cookie pattern for admin operations

## Installation

### Prerequisites
- PostgreSQL 16+
- Node.js 20+
- TypeScript 5+

### Setup

1. **Install Dependencies**
   ```bash
   cd plugins/content-manager
   npm install
   ```

2. **Build TypeScript**
   ```bash
   npm run build
   ```

3. **Install Plugin**
   - Use the plugin admin interface to install the plugin
   - Migrations will run automatically during installation
   - Default file types will be populated

4. **Activate Plugin**
   - Activate through admin interface
   - API routes will be registered
   - Scheduled publishing service will start

## API Endpoints

### Content Management

**List Content**
```
GET /api/content
Query Parameters:
  - status: draft|published|scheduled|archived
  - category_id: UUID
  - tag_id: UUID
  - search: string (searches title and body)
  - page: number (default: 1)
  - page_size: number (default: 20, max: 100)
  - sort_by: created_at|updated_at|published_at|title
  - sort_order: asc|desc

Response: { success: boolean, data: PaginatedResult<Content> }
```

**Get Content**
```
GET /api/content/:id

Response: { success: boolean, data: ContentWithRelations }
```

**Create Content**
```
POST /api/content
Body: {
  title: string (required)
  slug?: string (auto-generated if not provided)
  body_html: string (required)
  excerpt?: string
  meta_description?: string
  meta_keywords?: string
  featured_image_id?: string (UUID)
  status?: 'draft'|'published'|'scheduled' (default: draft)
  publish_at?: ISO 8601 date (required if status=scheduled)
  category_ids?: string[] (UUIDs)
  tag_ids?: string[] (UUIDs)
}

Permissions: Editor role required
Response: { success: boolean, data: Content }
```

**Update Content**
```
PUT /api/content/:id
Body: Partial<CreateContentInput> + { change_summary?: string }

Permissions:
  - Editor: Can update own drafts
  - Admin: Can update all content including published
Response: { success: boolean, data: Content }
```

**Delete Content**
```
DELETE /api/content/:id

Permissions: Admin only
Response: { success: boolean }
```

**Publish Content**
```
POST /api/content/:id/publish
Body: { publish_at?: ISO 8601 date }

Permissions: Admin only
Response: { success: boolean, data: Content }
```

**Unpublish Content**
```
POST /api/content/:id/unpublish

Permissions: Admin only
Response: { success: boolean, data: Content }
```

### Version History

**Get Versions**
```
GET /api/content/:id/versions

Response: { success: boolean, data: ContentVersion[] }
```

**Restore Version**
```
POST /api/content/:id/restore/:version

Permissions: Admin only
Response: { success: boolean, data: Content }
```

### Media Management

**Upload Media**
```
POST /api/content/media/upload
Content-Type: multipart/form-data
Body:
  - file: File (required)
  - content_id?: UUID
  - alt_text?: string
  - caption?: string

Permissions: Editor role required
Response: { success: boolean, data: Media }
```

**List Media**
```
GET /api/content/media
Query Parameters:
  - type: image|document|video|audio|archive|other
  - content_id: UUID
  - page: number
  - page_size: number

Response: { success: boolean, data: PaginatedResult<Media> }
```

**Delete Media**
```
DELETE /api/content/media/:id

Permissions: Admin only
Response: { success: boolean }
```

### Categories

**List Categories**
```
GET /api/content/categories

Response: { success: boolean, data: Category[] (hierarchical) }
```

**Create Category**
```
POST /api/content/categories
Body: {
  name: string (required)
  slug?: string (auto-generated if not provided)
  description?: string
  parent_id?: UUID
  display_order?: number (default: 0)
}

Permissions: Admin only
Response: { success: boolean, data: Category }
```

**Update Category**
```
PUT /api/content/categories/:id
Body: Partial of create input

Permissions: Admin only
Response: { success: boolean, data: Category }
```

**Delete Category**
```
DELETE /api/content/categories/:id

Permissions: Admin only
Note: Fails if category has content or child categories
Response: { success: boolean }
```

### Tags

**List Tags**
```
GET /api/content/tags

Response: { success: boolean, data: Tag[] }
```

**Create Tag**
```
POST /api/content/tags
Body: {
  name: string (required)
  slug?: string (auto-generated if not provided)
}

Permissions: Editor role required
Response: { success: boolean, data: Tag }
```

**Delete Tag**
```
DELETE /api/content/tags/:id

Permissions: Admin only
Response: { success: boolean }
```

### File Types Configuration

**List Allowed File Types**
```
GET /api/content/file-types

Response: { success: boolean, data: AllowedFileType[] }
```

**Add File Type**
```
POST /api/content/file-types
Body: {
  mime_type: string (required)
  file_extension: string (required)
  category: string (required)
  description?: string
  max_file_size?: number (bytes)
  is_enabled?: boolean (default: true)
}

Permissions: Admin only
Response: { success: boolean, data: AllowedFileType }
```

**Update File Type**
```
PUT /api/content/file-types/:id
Body: {
  is_enabled?: boolean
  max_file_size?: number
  description?: string
}

Permissions: Admin only
Response: { success: boolean, data: AllowedFileType }
```

## Database Schema

The plugin creates the following schema and tables:

- **plugin_content_manager** schema
  - **content** - Main content table
  - **content_versions** - Version history
  - **categories** - Hierarchical categories
  - **tags** - Flat tags
  - **content_categories** - Content-category relationships
  - **content_tags** - Content-tag relationships
  - **media** - Uploaded files metadata
  - **allowed_file_types** - File type configuration
  - **plugin_migrations** - Migration tracking

## Scheduled Publishing

The plugin includes a background service that runs every minute to check for content with `status='scheduled'` and `publish_at <= now`. Matching content is automatically published.

## File Upload Configuration

### Default Allowed File Types

- **Images**: PNG, JPG, JPEG, GIF, WebP (10MB limit)
- **Documents**: PDF, DOC, DOCX (50MB limit)
- **Media**: MP4, MP3, WAV (100MB limit)
- **Archives**: ZIP, RAR, 7Z (100MB limit)
- **Custom**: PSD, AI, JSON, XML (100MB limit)

### Adding New File Types

Use the admin API to add additional file types:

```bash
curl -X POST /api/content/file-types \
  -H "Content-Type: application/json" \
  -d '{
    "mime_type": "application/x-python",
    "file_extension": "py",
    "category": "code",
    "description": "Python source files",
    "max_file_size": 5242880
  }'
```

## Development

### Build
```bash
npm run build        # Compile TypeScript
npm run watch        # Watch mode
npm run clean        # Clean dist folder
```

### Testing
```bash
npm test             # Run tests
npm run test:watch   # Watch mode
```

## Version History

### 1.0.0 (Initial Release)
- Core content management (CRUD)
- TinyMCE rich text editor
- Media upload system
- Version history tracking
- Scheduled publishing
- Hierarchical categories and tags
- Role-based permissions
- Configurable file types

## License

MIT

## Author

Kevin Althaus <contact@kevinalthaus.com>
