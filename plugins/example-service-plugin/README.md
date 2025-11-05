# Example Service-Based Plugin

This plugin demonstrates the **CORRECT architecture** for writing plugins in this system.

## ✅ What This Plugin Does Right

### 1. Uses Centralized Services (NO Direct DB Access)

```typescript
// ✅ GOOD - Uses BlogService
const post = await context.services.blog.createPost({
  title: 'My Post',
  body_html: '<p>Content</p>',
  status: 'draft',
}, userId);

// ❌ BAD - Direct database access (NEVER DO THIS)
const result = await pool.query(
  'INSERT INTO blog_posts (title, body_html) VALUES ($1, $2)',
  [title, body]
);
```

### 2. Error Handling with Graceful Degradation

```typescript
try {
  // Plugin logic
  const post = await blogService.createPost(...);
  return { success: true, data: post };
} catch (error) {
  // Log but don't crash
  logger.error('Plugin execution error:', error);
  return {
    success: false,
    error: 'Plugin execution failed',
    retry: true,
  };
}
```

### 3. Service Injection via Context

```typescript
export async function handler(context: PluginExecutionContext) {
  const { services, logger, user, request } = context;

  // Services are injected by the system
  const blogService = services.blog as IBlogService;
  const editorService = services.editor as IEditorService;
  const taxonomyService = services.taxonomy as ITaxonomyService;
}
```

### 4. Health Check Implementation

```typescript
export async function healthCheck(context: PluginExecutionContext) {
  // Verify services are accessible
  const blogService = context.services.blog as IBlogService;

  if (!blogService) {
    return { healthy: false, message: 'BlogService not available' };
  }

  const health = await blogService.healthCheck();

  return health;
}
```

## ❌ What NOT to Do

### 1. Direct Database Access

```typescript
// ❌ NEVER DO THIS
const pool = new Pool({ ... });
const result = await pool.query('INSERT INTO ...');
```

### 2. Create Your Own Database Schemas

```typescript
// ❌ NEVER DO THIS
await pool.query('CREATE SCHEMA plugin_my_plugin');
await pool.query('CREATE TABLE plugin_my_plugin.my_table (...)');
```

### 3. Access Other Plugins' Data

```typescript
// ❌ NEVER DO THIS
await pool.query('SELECT * FROM plugin_other.content');
```

### 4. Throw Unhandled Errors

```typescript
// ❌ BAD - Will crash the plugin (but not the system thanks to PluginExecutor)
if (error) {
  throw new Error('Something went wrong');
}

// ✅ GOOD - Return graceful error
if (error) {
  logger.error('Error occurred:', error);
  return { success: false, error: 'Operation failed', retry: true };
}
```

## Plugin Architecture Benefits

### Error Isolation

The PluginExecutor wraps all plugin execution with:
- **Try-catch blocks**: Errors don't crash the system
- **Timeout protection**: Hanging plugins are terminated
- **Circuit breaker**: Auto-disable after 5 failures
- **Graceful degradation**: System continues even if plugin fails

### Service-Based Architecture

Benefits:
- ✅ No direct DB coupling
- ✅ Automatic validation
- ✅ Consistent error handling
- ✅ Transaction management
- ✅ Service-level caching
- ✅ Easier to test
- ✅ Better maintainability

## Available Services

### BlogService

```typescript
const blogService = context.services.blog as IBlogService;

// Create post
const post = await blogService.createPost(data, userId);

// List posts
const posts = await blogService.listPosts({ page: 1, limit: 10, authorId: userId });

// Get post
const post = await blogService.getPostById(id);

// Update post
const updated = await blogService.updatePost(id, data, userId);

// Delete post
const deleted = await blogService.deletePost(id, userId);

// Publish post
const published = await blogService.publishPost(id, userId);

// Health check
const health = await blogService.healthCheck();
```

### EditorService

```typescript
const editorService = context.services.editor as IEditorService;

// Convert HTML to EditorContent
const content = editorService.fromHTML(html);

// Validate content
const validation = editorService.validate(content);

// Sanitize HTML
const sanitized = editorService.sanitize(html);

// Get word count
const wordCount = editorService.getWordCount(content);
```

### TaxonomyService

```typescript
const taxonomyService = context.services.taxonomy as ITaxonomyService;

// Create vocabulary
const vocab = await taxonomyService.getOrCreateVocabulary('categories');

// Create term
const term = await taxonomyService.getOrCreateTerm(vocab.id, 'Technology');
```

## Plugin Manifest (plugin.yaml)

```yaml
name: example-service-plugin
version: 1.0.0
description: Example plugin demonstrating service-based architecture

capabilities:
  - blog:read
  - blog:write
  - editor:use
  - taxonomy:read

services:
  required:
    - blog
    - editor
    - taxonomy

entrypoint: dist/index.js

hooks:
  onInstall: scripts/install.js
  onActivate: scripts/activate.js
  onDeactivate: scripts/deactivate.js
```

## Endpoints

This example plugin exposes:

- `POST /create-post` - Create a blog post
- `GET /my-posts` - List your blog posts
- `GET /post/:id` - Get specific post
- `POST /publish/:id` - Publish a post

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test
```

## Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests with Playwright
npm run test:e2e
```

## Golden Rule

**Plugins use services, services access data.**

This architecture ensures:
1. **Stability**: Plugin failures don't crash the system
2. **Maintainability**: Clear separation of concerns
3. **Testability**: Easy to mock services
4. **Scalability**: Services can be optimized independently
5. **Security**: Centralized authorization and validation

**When in doubt, use a service. Never touch the database directly.**
