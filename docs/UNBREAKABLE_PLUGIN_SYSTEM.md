# Unbreakable Plugin System

## Overview

The plugin system has been redesigned to ensure **plugin failures NEVER crash the main system**. This document explains the complete architecture and how it achieves bulletproof error isolation.

## Core Components

### 1. PluginExecutor (packages/main-app/src/plugins/PluginExecutor.ts)

The PluginExecutor provides comprehensive error isolation for all plugin execution:

#### Features:
- ✅ **Try-Catch Wrapper**: All plugin execution wrapped in try-catch blocks
- ✅ **Timeout Protection**: Plugins that hang are terminated after 30 seconds
- ✅ **Circuit Breaker**: Auto-disable plugins after 5 consecutive failures
- ✅ **Graceful Error Responses**: Errors returned, not thrown
- ✅ **Service Injection**: Centralized services injected into plugin context

#### Key Methods:

```typescript
async executePlugin(
  plugin: Plugin,
  context: PluginExecutionContext,
  timeoutMs = 30000
): Promise<PluginExecutionResult>
```

Executes a plugin with full error isolation:
- Checks if plugin is enabled
- Checks circuit breaker state
- Wraps execution in timeout
- Returns structured result (success/failure)
- Records failures for circuit breaker

```typescript
async healthCheck(
  plugin: Plugin,
  context: PluginExecutionContext
): Promise<{ healthy: boolean; message?: string }>
```

Checks if a plugin is healthy and responsive.

#### Circuit Breaker Logic:

```
┌─────────────────────────────────────────────┐
│ Plugin Execution                            │
│  1. Check: Is plugin enabled?              │
│  2. Check: Circuit breaker open?           │
│  3. Execute with timeout protection        │
│  4. On success: Reset circuit breaker      │
│  5. On failure: Record failure            │
│  6. After 5 failures: Open circuit         │
└─────────────────────────────────────────────┘
```

Configuration:
- `failureThreshold`: 5 failures before opening circuit
- `resetTimeout`: 60000ms (1 minute) before retrying

### 2. PluginManager (packages/main-app/src/plugins/manager.ts)

The PluginManager orchestrates plugin lifecycle with the PluginExecutor:

#### Features:
- ✅ **Service Injection**: Injects BlogService, EditorService, TaxonomyService
- ✅ **Plugin Registry**: Tracks installed/active/inactive plugins
- ✅ **Health Monitoring**: Per-plugin health checks
- ✅ **Circuit Breaker Management**: View stats, manual reset

#### Key Methods:

```typescript
async executePlugin(
  id: string,
  context: Partial<PluginExecutionContext>,
  logger: PluginLogger
): Promise<PluginExecutionResult>
```

Executes a plugin with injected services and error isolation.

```typescript
setServices(services: {
  blog?: IBlogService;
  editor?: unknown;
  taxonomy?: unknown;
}): void
```

Inject centralized services for plugins to use.

```typescript
getPluginStats(id: string): {
  failures: number;
  isOpen: boolean;
  lastFailureTime: number | null;
} | null
```

Get circuit breaker statistics for monitoring.

### 3. Plugin Execution Context

Every plugin receives a standardized execution context:

```typescript
interface PluginExecutionContext {
  // User making the request
  user: {
    id: string;
    email: string;
    role: string;
  };

  // Centralized services (MUST USE THESE)
  services: {
    blog: IBlogService;
    editor: IEditorService;
    taxonomy: ITaxonomyService;
  };

  // Plugin-specific logger
  logger: PluginLogger;

  // Plugin configuration
  config: Record<string, unknown>;

  // Request context (if applicable)
  request?: {
    method: string;
    path: string;
    body: unknown;
    query: Record<string, unknown>;
  };
}
```

## Service-Based Architecture

### Golden Rule:

**Plugins use services, services access data.**

### Why This Matters:

❌ **BAD - Direct DB Access:**
```typescript
const result = await pool.query(
  'INSERT INTO plugin_content_manager.content (title, body_html) VALUES ($1, $2)',
  [title, body]
);
```

✅ **GOOD - Using BlogService:**
```typescript
const post = await context.services.blog.createPost({
  title: 'My Post',
  body_html: '<p>Content</p>',
  status: 'draft',
}, userId);
```

### Benefits:

1. **No Direct DB Coupling**: Plugins don't need database credentials or schema knowledge
2. **Automatic Validation**: Services validate data before persistence
3. **Consistent Error Handling**: Services return structured errors
4. **Transaction Management**: Services handle transactions internally
5. **Service-Level Caching**: Services can implement caching transparently
6. **Easier to Test**: Mock services instead of mocking database
7. **Better Maintainability**: Schema changes don't break plugins

## Example: Service-Based Plugin

See `plugins/example-service-plugin/` for a complete example.

### Creating a Blog Post:

```typescript
export async function handler(context: PluginExecutionContext): Promise<unknown> {
  const { services, logger, user } = context;

  // Get BlogService from injected services
  const blogService = services.blog as IBlogService;

  try {
    // Create post using service
    const post = await blogService.createPost(
      {
        title: 'My Post',
        body_html: '<p>Content</p>',
        status: 'draft',
      },
      user.id
    );

    logger.info(`Blog post created: ${post.id}`);

    return {
      success: true,
      data: { postId: post.id },
    };
  } catch (error) {
    // Log error but don't crash
    logger.error('Plugin execution error:', error);

    // Return graceful error
    return {
      success: false,
      error: 'Plugin execution failed',
      retry: true,
    };
  }
}
```

## Error Isolation Flow

```
User Request
    ↓
API Endpoint
    ↓
PluginManager.executePlugin(id, context, logger)
    ↓
Build full context with injected services
    ↓
PluginExecutor.executePlugin(plugin, fullContext)
    ↓
Check: Plugin enabled?
    ↓ YES
Check: Circuit breaker open?
    ↓ NO (circuit closed)
Execute with timeout protection (30s)
    ↓
    ├─→ SUCCESS ──→ Reset circuit breaker
    │               Return { success: true, data: result }
    │
    └─→ ERROR ────→ Record failure
                    If failures >= 5: Open circuit
                    Return { success: false, error: message }
    ↓
API returns result
    ↓
System continues operating normally
```

## What Makes It Unbreakable?

### 1. Multiple Layers of Protection

```
┌──────────────────────────────────────────────────────┐
│ Layer 1: Try-Catch Wrapper                          │
│  - Catches all synchronous errors                   │
│  - Catches unhandled promise rejections             │
└──────────────────────────────────────────────────────┘
               ↓
┌──────────────────────────────────────────────────────┐
│ Layer 2: Timeout Protection                         │
│  - Kills plugins that hang or infinite loop         │
│  - Default: 30 seconds                              │
└──────────────────────────────────────────────────────┘
               ↓
┌──────────────────────────────────────────────────────┐
│ Layer 3: Circuit Breaker                            │
│  - Auto-disables failing plugins                    │
│  - Prevents cascade failures                        │
│  - Automatic retry after timeout                    │
└──────────────────────────────────────────────────────┘
               ↓
┌──────────────────────────────────────────────────────┐
│ Layer 4: Graceful Degradation                       │
│  - Returns error objects, never throws              │
│  - System continues despite plugin failure          │
│  - Users see error message, not crash               │
└──────────────────────────────────────────────────────┘
```

### 2. No Single Point of Failure

- ❌ **Old Way**: Plugin throws error → Crashes request → Crashes server
- ✅ **New Way**: Plugin throws error → Caught by executor → Logged → System continues

### 3. Observable and Debuggable

Every plugin execution provides:
- Execution time (milliseconds)
- Success/failure status
- Error messages (in development)
- Circuit breaker statistics

### 4. Self-Healing

The circuit breaker provides automatic recovery:
- After 5 failures, plugin is auto-disabled
- After 60 seconds, system retries the plugin
- If successful, plugin is re-enabled
- If still failing, circuit reopens

## Available Services

### BlogService

```typescript
const blogService = context.services.blog as IBlogService;

// Create post
const post = await blogService.createPost(data, userId);

// List posts (with optional filtering)
const posts = await blogService.listPosts({
  page: 1,
  limit: 10,
  status: 'published',
  authorId: userId,
});

// Get single post
const post = await blogService.getPostById(id);

// Update post
const updated = await blogService.updatePost(id, data, userId);

// Delete post (soft delete)
const deleted = await blogService.deletePost(id, userId);

// Publish post
const published = await blogService.publishPost(id, userId);

// Unpublish post
const unpublished = await blogService.unpublishPost(id, userId);

// Check slug availability
const exists = await blogService.slugExists(slug, excludeId);

// Health check
const health = await blogService.healthCheck();
```

### EditorService

```typescript
const editorService = context.services.editor as IEditorService;

// Convert HTML to EditorContent structure
const content = editorService.fromHTML(html);

// Convert EditorContent to HTML
const html = editorService.toHTML(content);

// Validate content
const validation = editorService.validate(content);

// Sanitize HTML (remove malicious tags)
const sanitized = editorService.sanitize(html);

// Extract plain text
const text = editorService.toPlainText(content);

// Get word count
const wordCount = editorService.getWordCount(content);

// Get character count
const charCount = editorService.getCharacterCount(content);
```

### TaxonomyService

```typescript
const taxonomyService = context.services.taxonomy as ITaxonomyService;

// Create vocabulary
const vocab = await taxonomyService.createVocabulary({
  name: 'Categories',
  machine_name: 'categories',
  description: 'Blog categories',
});

// Get vocabulary
const vocab = await taxonomyService.getVocabulary(id);
const vocab = await taxonomyService.getVocabularyByMachineName('categories');

// Create term
const term = await taxonomyService.createTerm({
  vocabulary_id: vocab.id,
  name: 'Technology',
  slug: 'technology',
});

// Get terms
const terms = await taxonomyService.getTermsByVocabulary(vocab.id);

// Assign term to entity (e.g., blog post)
await taxonomyService.assignTermToEntity('blog_post', postId, termId);

// Get entity terms
const terms = await taxonomyService.getEntityTerms('blog_post', postId);
```

## Monitoring and Debugging

### Circuit Breaker Stats

```typescript
// Get stats for a plugin
const stats = pluginManager.getPluginStats('my-plugin');

console.log(stats);
// {
//   failures: 3,
//   isOpen: false,
//   lastFailureTime: 1698765432000
// }
```

### Manually Reset Circuit Breaker

```typescript
// Admin operation: force reset circuit breaker
pluginManager.resetPluginCircuit('my-plugin');
```

### Health Check

```typescript
// Check if plugin is healthy
const health = await pluginManager.checkPluginHealth('my-plugin', logger);

console.log(health);
// { healthy: true }
// or
// { healthy: false, message: 'Circuit breaker is open' }
```

## Plugin Development Guidelines

### DO:
✅ Use centralized services (BlogService, EditorService, TaxonomyService)
✅ Keep plugin templates in plugin directory
✅ Pull in global styles from main app
✅ Handle errors gracefully with try-catch
✅ Log errors for debugging
✅ Write tests for plugin logic
✅ Document plugin capabilities
✅ Use TypeScript for type safety
✅ Follow semantic versioning
✅ Return structured results (success/failure)

### DON'T:
❌ Access database directly (use services)
❌ Create your own database schemas
❌ Throw unhandled errors (return error objects)
❌ Pollute global namespace
❌ Hardcode configuration
❌ Skip input validation
❌ Ignore service return values
❌ Mix plugin styles with main app
❌ Block the event loop (long-running operations)
❌ Access other plugins' data

## Testing

### Unit Tests

```typescript
import { pluginExecutor } from '../PluginExecutor';
import { mockPluginContext } from '@monorepo/shared/testing';

describe('My Plugin', () => {
  it('should handle errors gracefully', async () => {
    const plugin = {
      name: 'test-plugin',
      version: '1.0.0',
      enabled: true,
      handler: async () => {
        throw new Error('Plugin error');
      },
    };

    const context = mockPluginContext();
    const result = await pluginExecutor.executePlugin(plugin, context);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Plugin execution failed');
  });

  it('should timeout hanging plugins', async () => {
    const plugin = {
      name: 'hanging-plugin',
      version: '1.0.0',
      enabled: true,
      handler: async () => {
        // Infinite loop
        while (true) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      },
    };

    const context = mockPluginContext();
    const result = await pluginExecutor.executePlugin(plugin, context, 1000); // 1 second timeout

    expect(result.success).toBe(false);
    expect(result.error).toContain('timeout');
  });
});
```

### Integration Tests (Playwright)

```typescript
test('plugin failure does not crash system', async ({ page }) => {
  // Trigger plugin that will fail
  await page.goto('/api/plugin/failing-plugin');

  // Verify error response, not crash
  const response = await page.textContent('body');
  expect(response).toContain('Plugin execution failed');

  // Verify system is still responsive
  await page.goto('/');
  await expect(page).toHaveURL('/');
});
```

## Summary

The unbreakable plugin system provides:

1. **Stability**: Plugin failures don't crash the system
2. **Maintainability**: Clear separation of concerns
3. **Testability**: Easy to mock services
4. **Scalability**: Services can be optimized independently
5. **Security**: Centralized authorization and validation
6. **Observability**: Circuit breaker stats, health checks, logs
7. **Self-Healing**: Automatic recovery via circuit breaker

**When in doubt, use a service. Never touch the database directly.**

## References

- Plugin Architecture Documentation: `docs/PLUGIN_ARCHITECTURE.md`
- Example Service-Based Plugin: `plugins/example-service-plugin/`
- PluginExecutor Implementation: `packages/main-app/src/plugins/PluginExecutor.ts`
- PluginManager Implementation: `packages/main-app/src/plugins/manager.ts`
- BlogService Implementation: `packages/main-app/src/services/BlogService.ts`
- Service Interfaces: `packages/shared/src/services/interfaces.ts`
