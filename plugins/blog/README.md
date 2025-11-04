# Blog Plugin

Full-featured blog plugin with SEO optimization, WCAG AA accessibility, and integration with the taxonomy service.

## Features

- Complete blog post management (create, edit, publish, unpublish, delete)
- Rich author profiles with social media links
- Version history with automatic versioning on updates
- SEO optimization (Open Graph, Twitter Cards, structured data, canonical URLs)
- WCAG AA accessibility compliance
- Integration with taxonomy service for categories and tags
- Full-text search support
- Reading time calculation
- Soft delete support
- Preview functionality with secure tokens

## Installation

The plugin is automatically installed via the plugin manager.

## API Endpoints

### Blog Posts

- `GET /api/blog` - List blog posts with filtering and pagination
- `GET /api/blog/:id` - Get single blog post with details
- `POST /api/blog` - Create new blog post (Editor role)
- `PUT /api/blog/:id` - Update blog post
- `DELETE /api/blog/:id` - Soft delete blog post (Admin only)
- `POST /api/blog/:id/publish` - Publish blog post (Admin only)
- `POST /api/blog/:id/unpublish` - Unpublish blog post (Admin only)

### Public Endpoints

- `GET /api/blog/public` - List published blog posts (no auth required)
- `GET /api/blog/public/:slug` - Get published blog post by slug (no auth required)

## Database Schema

The plugin creates the following tables in the `plugin_blog` schema:

- `blog_posts` - Main blog posts table
- `blog_post_versions` - Version history
- `author_profiles` - Author information
- `blog_seo_metadata` - SEO metadata for posts
- `preview_tokens` - Secure preview tokens

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
