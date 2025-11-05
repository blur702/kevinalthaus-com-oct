# Plugin Architecture

## Overview

This document defines the plugin architecture for the system. Plugins are isolated, self-contained modules that extend system functionality without risking system stability. **A failing plugin should never bring down the entire system.**

## Core Principles

### 1. Service-Based Architecture
**Plugins MUST use centralized, proven services**. Plugins should NEVER:
- Access the database directly
- Implement their own database schemas
- Create their own data access layers

**Plugins SHOULD:**
- Use `BlogService` for blog/content operations
- Use `EditorService` for WYSIWYG content transformation
- Use `TaxonomyService` for categorization/tagging
- Use provided interfaces and services from `@monorepo/shared`

### 2. Template and Frontend Isolation
**All plugin templates and UI components must live in the plugin directory:**

```
plugins/my-plugin/
  ├── plugin.yaml              # Plugin manifest
  ├── src/
  │   ├── index.ts            # Backend handler (uses services)
  │   └── routes/             # Optional API routes
  ├── frontend/                # Frontend components
  │   ├── components/
  │   ├── pages/
  │   └── styles/             # Plugin-specific styles
  └── public/                  # Static assets
```

**Frontend Integration:**
- Plugins pull in global styles from main app (shared theme)
- Plugin-specific styles override/extend global styles
- Components are self-contained and importable

### 3. Error Isolation
**Plugin errors must be contained:**
- Wrap plugin execution in try-catch blocks
- Log errors but continue system operation
- Provide graceful degradation
- Use health checks to monitor plugin status

## Plugin Structure

### Minimum Plugin Structure
```
plugins/my-plugin/
  ├── plugin.yaml
  ├── src/index.ts
  └── package.json
```

### Full Plugin Structure
```
plugins/my-plugin/
  ├── plugin.yaml              # Manifest (required)
  ├── package.json             # Dependencies
  ├── tsconfig.json            # TypeScript config
  ├── src/
  │   ├── index.ts            # Main entry point
  │   ├── routes/             # API routes (optional)
  │   ├── services/           # Plugin services (optional)
  │   └── types/              # TypeScript types
  ├── frontend/                # Frontend code (optional)
  │   ├── components/
  │   ├── pages/
  │   ├── hooks/
  │   └── styles/
  ├── public/                  # Static assets
  ├── tests/                   # Unit tests
  └── README.md               # Plugin documentation
```

### Plugin Manifest (plugin.yaml)
```yaml
name: my-plugin
version: 1.0.0
description: Brief description
author: Your Name
license: MIT

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
  optional:
    - media

entrypoint: dist/index.js
frontend: frontend/index.tsx  # Optional

dependencies:
  - other-plugin: "^1.0.0"     # Optional

hooks:
  onInstall: scripts/install.js
  onActivate: scripts/activate.js
  onDeactivate: scripts/deactivate.js
```

## Using Centralized Services

### BlogService Example
```typescript
import type { IBlogService } from '@monorepo/shared';

export async function handler(context: PluginExecutionContext) {
  const { services, logger } = context;

  // Get BlogService from context
  const blogService = services.blog as IBlogService;

  // Create a blog post
  const post = await blogService.createPost(
    {
      title: 'My Post',
      body_html: '<p>Content</p>',
      status: 'draft',
    },
    context.user.id
  );

  // List posts by user
  const userPosts = await blogService.listPosts({
    page: 1,
    limit: 10,
    authorId: context.user.id,
  });

  logger.info(`Created post: ${post.id}`);
  return { success: true, postId: post.id };
}
```

### EditorService Example
```typescript
import type { IEditorService, EditorContent } from '@monorepo/shared';

export async function transformContent(context: PluginExecutionContext, html: string) {
  const editorService = context.services.editor as IEditorService;

  // Convert HTML to EditorContent structure
  const content: EditorContent = editorService.fromHTML(html);

  // Validate content
  const validation = editorService.validate(content);
  if (!validation.valid) {
    throw new Error(`Invalid content: ${validation.errors?.join(', ')}`);
  }

  // Sanitize HTML
  const sanitized = editorService.sanitize(html);

  // Get word count
  const wordCount = editorService.getWordCount(content);

  return {
    content,
    sanitized,
    wordCount,
  };
}
```

### TaxonomyService Example
```typescript
import type { ITaxonomyService } from '@monorepo/shared';

export async function categorizeBlogPost(
  context: PluginExecutionContext,
  postId: string,
  categories: string[]
) {
  const taxonomyService = context.services.taxonomy as ITaxonomyService;
  const blogService = context.services.blog as IBlogService;

  // Create vocabulary if needed
  const vocab = await taxonomyService.getOrCreateVocabulary('blog_categories');

  // Create terms
  for (const category of categories) {
    const term = await taxonomyService.getOrCreateTerm(vocab.id, category);

    // Associate term with blog post (plugin-specific logic)
    await blogService.updatePost(postId, {
      // Add taxonomy metadata
      meta_keywords: categories.join(', '),
    }, context.user.id);
  }
}
```

## Plugin Execution Context

Every plugin handler receives a `PluginExecutionContext`:

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
    // ... other services
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

## Error Handling and Isolation

### Plugin Wrapper (System-Level)
```typescript
async function executePlugin(plugin: Plugin, context: PluginExecutionContext) {
  try {
    const result = await plugin.handler(context);
    return { success: true, data: result };
  } catch (error) {
    context.logger.error(`Plugin ${plugin.name} failed:`, error);

    // Log to system monitoring
    systemLogger.error('Plugin execution failed', {
      plugin: plugin.name,
      error: error.message,
      stack: error.stack,
    });

    // Return error without crashing system
    return {
      success: false,
      error: 'Plugin execution failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    };
  }
}
```

### Plugin-Level Error Handling
```typescript
export async function handler(context: PluginExecutionContext) {
  const { services, logger } = context;

  try {
    // Plugin logic using services
    const post = await services.blog.createPost({ ... }, context.user.id);
    return { success: true, postId: post.id };
  } catch (error) {
    // Log error but don't crash
    logger.error('Failed to create post:', error);

    // Return graceful error
    return {
      success: false,
      error: 'Could not create post',
      retry: true,
    };
  }
}
```

## Frontend Integration

### Plugin Frontend Component
```typescript
// plugins/my-plugin/frontend/components/MyComponent.tsx
import React from 'react';
import { useTheme } from '@main-app/hooks'; // Import from main app
import './styles/component.css';  // Plugin-specific styles

export function MyComponent() {
  const theme = useTheme(); // Use main app theme

  return (
    <div className="my-plugin-component" style={{ color: theme.primaryColor }}>
      <h2>Plugin Content</h2>
      {/* Plugin-specific UI */}
    </div>
  );
}
```

### Plugin Styles
```css
/* plugins/my-plugin/frontend/styles/component.css */

/* Extend/override main app styles */
.my-plugin-component {
  padding: var(--spacing-lg); /* Use main app CSS variables */
  border-radius: var(--border-radius);
  background: var(--background-secondary);
}

/* Plugin-specific overrides */
.my-plugin-component h2 {
  color: var(--primary-color);
  font-family: var(--font-family-heading);
}
```

## Best Practices

### DO:
✅ Use centralized services (BlogService, EditorService, etc.)
✅ Keep plugin templates in plugin directory
✅ Pull in global styles from main app
✅ Handle errors gracefully
✅ Log errors for debugging
✅ Write tests for plugin logic
✅ Document plugin capabilities
✅ Use TypeScript for type safety
✅ Follow semantic versioning

### DON'T:
❌ Access database directly
❌ Create your own database schemas
❌ Crash on errors - handle them
❌ Pollute global namespace
❌ Hardcode configuration
❌ Skip input validation
❌ Ignore service return values
❌ Mix plugin styles with main app

## Plugin Lifecycle

### Installation
1. Plugin manifest validated
2. Dependencies checked
3. `onInstall` hook executed
4. Plugin registered in system
5. Frontend assets built/bundled

### Activation
1. `onActivate` hook executed
2. Services initialized and injected
3. Routes registered
4. Frontend components loaded
5. Plugin marked as active

### Deactivation
1. `onDeactivate` hook executed
2. Routes unregistered
3. Frontend components unloaded
4. Cleanup performed
5. Plugin marked as inactive

### Uninstallation
1. Plugin deactivated first
2. `onUninstall` hook executed
3. Plugin data cleaned up (optional)
4. Plugin removed from system

## Health Checks

Plugins should expose health checks:

```typescript
export async function healthCheck(context: PluginExecutionContext): Promise<{
  healthy: boolean;
  message?: string;
}> {
  try {
    // Verify services are accessible
    const blogHealth = await context.services.blog.healthCheck();
    const editorHealth = await context.services.editor.healthCheck();

    if (!blogHealth.healthy || !editorHealth.healthy) {
      return {
        healthy: false,
        message: 'Required services unavailable',
      };
    }

    return { healthy: true };
  } catch (error) {
    return {
      healthy: false,
      message: error.message,
    };
  }
}
```

## Testing Plugins

### Unit Tests
```typescript
// plugins/my-plugin/tests/handler.test.ts
import { handler } from '../src/index';
import { mockPluginContext } from '@monorepo/shared/testing';

describe('My Plugin', () => {
  it('should create a blog post using BlogService', async () => {
    const context = mockPluginContext({
      services: {
        blog: {
          createPost: jest.fn().mockResolvedValue({ id: '123', title: 'Test' }),
        },
      },
    });

    const result = await handler(context);

    expect(result.success).toBe(true);
    expect(context.services.blog.createPost).toHaveBeenCalled();
  });
});
```

### Integration Tests (Playwright)
```typescript
// e2e/plugins/my-plugin.spec.ts
import { test, expect } from '@playwright/test';

test('plugin renders correctly', async ({ page }) => {
  await page.goto('/plugins/my-plugin');

  // Verify plugin UI loads
  await expect(page.locator('.my-plugin-component')).toBeVisible();

  // Test plugin functionality
  await page.click('button.create-post');
  await expect(page.locator('.success-message')).toBeVisible();
});
```

## Migration Guide

### Converting Direct DB Access to Services

**Before (BAD - Direct DB Access):**
```typescript
const result = await pool.query(
  'INSERT INTO plugin_content_manager.content (title, body_html, created_by) VALUES ($1, $2, $3)',
  [title, body, userId]
);
```

**After (GOOD - Using BlogService):**
```typescript
const post = await context.services.blog.createPost(
  {
    title,
    body_html: body,
    status: 'draft',
  },
  userId
);
```

### Benefits
- ✅ No direct DB coupling
- ✅ Automatic validation
- ✅ Consistent error handling
- ✅ Transaction management
- ✅ Service-level caching
- ✅ Easier to test
- ✅ Better maintainability

## Summary

**Golden Rule:** Plugins use services, services access data.

This architecture ensures:
1. **Stability:** Plugin failures don't crash the system
2. **Maintainability:** Clear separation of concerns
3. **Testability:** Easy to mock services
4. **Scalability:** Services can be optimized independently
5. **Security:** Centralized authorization and validation

**When in doubt, use a service. Never touch the database directly.**
