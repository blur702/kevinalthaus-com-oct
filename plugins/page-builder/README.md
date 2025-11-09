# Page Builder Plugin

## Overview

The Page Builder plugin provides an intuitive block-based editor integrated with media management and WYSIWYG capabilities. It enables users to create responsive, accessible web pages using a drag-and-drop interface.

### Features

- **Drag-and-Drop Interface**: Intuitive visual editor for arranging content blocks
- **Responsive Grid System**: 12+ column grid with customizable breakpoints
- **Extensible Widgets**: 12+ built-in widgets with plugin-in-plugin architecture
- **Templates**: Reusable page layouts for consistent design
- **Reusable Blocks**: Save and reuse widget combinations across pages
- **Version History**: Automatic versioning with rollback capability
- **WCAG AA Compliance**: Full accessibility support for inclusive content
- **SEO Optimization**: Meta fields, semantic markup, and search-friendly output

## Installation

1. Install dependencies via lerna:
```bash
lerna bootstrap
```

2. Install the plugin via admin interface or CLI

3. Run migrations:
```bash
npm run migrate
```

## Architecture

### Plugin-in-Plugin System

The Page Builder uses a widget-based architecture where each widget is a self-contained plugin with its own:
- Component definition
- Configuration schema
- Type definitions
- Validation rules

### JSONB Storage

All page layouts are stored as JSONB in PostgreSQL, providing:
- Flexible schema evolution
- Fast queries with GIN indexes
- JSON path operations for widget searches

### Schema Isolation

All tables reside in the `plugin_page_builder` schema for:
- Namespace isolation
- Security boundaries
- Clean uninstallation

## Database

### Tables

#### pages
Core pages table with JSONB layout storage:
- **id**: UUID primary key
- **title**: VARCHAR(500) with length validation
- **slug**: VARCHAR(500) with unique constraint (excluding soft deletes)
- **layout_json**: JSONB containing grid config and widgets
- **meta_description**: VARCHAR(160) for SEO
- **meta_keywords**: TEXT for search optimization
- **status**: ENUM (draft, published, scheduled, archived)
- **publish_at**: TIMESTAMPTZ for scheduled publishing
- **published_at**: TIMESTAMPTZ tracking publication time
- **created_at/updated_at**: Automatic timestamps
- **created_by/updated_by**: UUID foreign keys to users
- **deleted_at/deleted_by**: Soft delete support

#### page_versions
Audit trail for page changes:
- **id**: UUID primary key
- **page_id**: Foreign key to pages (CASCADE delete)
- **version_number**: Integer (unique per page)
- **title/slug/layout_json/status**: Snapshot of page state
- **change_summary**: Optional description of changes
- **created_at/created_by**: Timestamp and user tracking

#### templates
Reusable page layouts:
- **id**: UUID primary key
- **name/description**: Template metadata
- **thumbnail_url**: Preview image (URL validated)
- **layout_json**: Complete page layout
- **category**: Optional grouping
- **is_public**: Visibility flag
- **created_at/updated_at/created_by/updated_by**: Standard tracking
- **deleted_at/deleted_by**: Soft delete support

#### reusable_blocks
Widget combinations for reuse:
- **id**: UUID primary key
- **name/description**: Block metadata
- **thumbnail_url**: Preview image
- **block_json**: Single widget or array of widgets
- **category**: Optional grouping
- **created_at/updated_at/created_by/updated_by**: Standard tracking
- **deleted_at/deleted_by**: Soft delete support

### Constraints

- **UUID Primary Keys**: All tables use UUIDs for distributed-safe IDs
- **Foreign Keys**: RESTRICT on user deletes to preserve audit trail
- **Check Constraints**: Length validation, JSON type validation, URL format validation
- **Unique Constraints**: Slug uniqueness (excluding soft deletes), version number per page

### Triggers

- **update_page_timestamp**: Automatically updates updated_at on page modifications
- **create_page_version**: Creates version snapshot on significant changes (layout, title, slug, status)

### Indexes

#### Performance Indexes
- **GIN on JSONB**: Fast widget searches and JSON path queries
- **Partial Indexes**: Status, slug filters exclude soft deletes
- **Composite Indexes**: Version lookups (page_id, version_number DESC)

#### Full-Text Search
- **pages_search**: GIN index on title + meta_description + layout_json for content search

## Development

### Build Commands

```bash
# Build TypeScript
npm run build

# Watch mode for development
npm run watch

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Format code
npm run format
```

### Adding Widgets

1. Create widget folder: `widgets/<widget-name>/`
2. Implement required files:
   - `component.tsx`: React component
   - `config.ts`: Joi validation schema
   - `types.ts`: TypeScript interfaces
3. Register in widget palette
4. Add documentation in `docs/WIDGETS.md`

Example structure:
```
widgets/
  text-content/
    component.tsx
    config.ts
    types.ts
    styles.module.css
```

### Testing

#### Unit Tests
- Lifecycle hooks (install, activate, deactivate, uninstall)
- Migration functions (idempotency, rollback safety)
- Validation schemas (Joi rules)

#### Integration Tests
- JSON schema validation
- Database constraints
- API endpoint security

## Security

### Input Sanitization
All user input is sanitized using `sanitize-html` before storage:
- HTML content in text widgets
- URLs in image/link widgets
- Custom code in advanced widgets

### Role-Based Access Control
All API endpoints check capabilities:
- `database:read` for viewing pages
- `database:write` for creating/editing pages
- `api:call` for template/block operations

### Content Security Policy
Custom code widgets execute within strict CSP:
- No inline scripts
- Restricted external resources
- Sandboxed iframes

## Performance

### JSONB Indexing
GIN indexes enable fast queries on JSON structure:
- Widget type searches
- Content searches across widgets
- Layout pattern matching

### Pagination
All list endpoints use cursor-based pagination:
- Efficient for large datasets
- Consistent results during concurrent writes

### Lazy Loading
Frontend implements progressive loading:
- Widgets load on viewport entry
- Images use lazy loading attributes
- Code-splitting for widget bundles

## Troubleshooting

### Migration Failures

**Symptom**: Migration fails with "connection refused" or "permission denied"

**Solutions**:
- Verify PostgreSQL is running
- Check connection pool configuration
- Ensure user has CREATE privileges on schema
- Review migration logs in `plugin_migrations` table

### Hook Errors

**Symptom**: Plugin fails to activate with "Missing app/services" error

**Solutions**:
- Verify `context.db` is available (Pool instance)
- Check `context.app` is Express instance
- Ensure shared packages are built (`lerna run build`)
- Review plugin execution context in main app

### Widget Registration Issues

**Symptom**: Custom widgets don't appear in editor

**Solutions**:
- Verify widget folder structure matches convention
- Check config.ts exports valid Joi schema
- Ensure types.ts implements WidgetInstance interface
- Review console for component errors

## Changelog

### v1.0.0
- Initial scaffolding
- Database schema with pages, versions, templates, reusable blocks
- Migration system with idempotency
- Lifecycle hooks with error handling
- TypeScript types and validation schemas
- Documentation and development setup

## License

MIT License - See LICENSE file for details

## Support

For issues and feature requests, please contact: contact@kevinalthaus.com
