# Plugin Development Guide

## Overview

This system provides a powerful plugin architecture that allows developers to extend functionality through a well-defined API. This guide will help you build services and plugins that are compatible with the Kevin Althaus platform.

## Table of Contents

1. [Plugin Architecture](#plugin-architecture)
2. [Plugin Manifest](#plugin-manifest)
3. [Database Integration](#database-integration)
4. [Security & Isolation](#security--isolation)
5. [API Integration](#api-integration)
6. [Theme System](#theme-system)
7. [Development Workflow](#development-workflow)
8. [Best Practices](#best-practices)
9. [Examples](#examples)

## Plugin Architecture

### Core Components

The platform uses a modular architecture with the following key components:

- **Plugin Registry**: Manages plugin lifecycle and metadata
- **Database Isolation**: Each plugin gets its own schema with resource quotas
- **Security Layer**: RBAC system with capability-based permissions
- **Theme System**: Support for both frontend and backend theming
- **API Gateway**: Centralized routing and proxy management

### Plugin Lifecycle

Plugins go through the following states:

- `installed` - Plugin is uploaded and validated
- `active` - Plugin is running and available
- `inactive` - Plugin is disabled but still installed
- `error` - Plugin encountered an error
- `updating` - Plugin is being updated

## Plugin Manifest

Every plugin must include a `plugin.yaml` manifest file in its root directory.

### Basic Structure

```yaml
name: my-awesome-plugin
version: 1.0.0
displayName: My Awesome Plugin
description: A comprehensive example plugin that demonstrates all available features
author:
  name: John Developer
  email: john@example.com
  url: https://johndeveloper.com
homepage: https://github.com/johndeveloper/my-awesome-plugin
repository:
  type: git
  url: https://github.com/johndeveloper/my-awesome-plugin.git
license: MIT
keywords:
  - utility
  - example
  - demo
capabilities:
  - database:read
  - database:write
  - api:call
  - theme:modify
entrypoint: dist/index.js
```

### Available Capabilities

Your plugin can request the following capabilities:

- `database:read` - Read from plugin-specific database schema
- `database:write` - Write to plugin-specific database schema
- `api:call` - Make external API calls
- `theme:modify` - Modify themes and UI components
- `settings:read` - Read system settings
- `settings:write` - Write system settings

### Frontend Integration

```yaml
frontend:
  entrypoint: dist/frontend.js
  assets:
    - styles/main.css
    - images/logo.png
```

### Backend API

```yaml
backend:
  entrypoint: dist/backend.js
  api:
    - method: GET
      path: /api/my-plugin/users
      handler: getUsersHandler
      middleware:
        - authentication
      requiredCapabilities:
        - database:read
    - method: POST
      path: /api/my-plugin/users
      handler: createUserHandler
      requiredCapabilities:
        - database:write
```

### Database Schema

```yaml
database:
  migrations:
    - migrations/001_initial.sql
    - migrations/002_add_indexes.sql
  schemas:
    - schemas/users.sql
    - schemas/settings.sql
```

### Plugin Settings

```yaml
settings:
  schema:
    apiKey:
      type: string
      label: API Key
      description: Your external service API key
      required: true
    maxItems:
      type: number
      label: Maximum Items
      description: Maximum number of items to process
      default: 100
      validation:
        min: 1
        max: 1000
    enableLogging:
      type: boolean
      label: Enable Logging
      description: Enable detailed logging for this plugin
      default: false
  defaults:
    apiKey: ''
    maxItems: 100
    enableLogging: false
```

## Database Integration

### Schema Isolation

Each plugin gets its own PostgreSQL schema with the naming convention: `plugin_<plugin-name>`

### Connection Management

```typescript
import type { PluginExecutionContext } from '@monorepo/shared';

// Example usage in your plugin
export async function getUsersHandler(context: PluginExecutionContext) {
  // Check if database connection is available
  if (!context.db) {
    throw new Error('Database connection not available');
  }

  // Use the PostgreSQL Pool directly
  const result = await context.db.query('SELECT * FROM users WHERE active = $1', [true]);

  return result.rows;
}
```

### Migration System

Create migration files in the `migrations/` directory:

```sql
-- migrations/001_initial.sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
```

### Resource Quotas

Each plugin has default resource limits:

- **Max Connections**: 5 concurrent database connections
- **Max Storage**: 100MB of database storage
- **Max Tables**: 20 tables per plugin
- **Max Rows**: 100,000 rows per table
- **Max Indexes**: 10 indexes per table

## Security & Isolation

### Role-Based Access Control (RBAC)

The system uses a capability-based permission system:

```typescript
import { PermissionContext, Capability } from '@monorepo/shared';

// Check permissions in your plugin
export function requiresPermission(capability: Capability) {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value;
    descriptor.value = function (context: PluginExecutionContext, ...args: any[]) {
      if (!hasCapability(context.permissions, capability)) {
        throw new Error(`Permission denied: ${capability} required`);
      }
      return method.apply(this, [context, ...args]);
    };
  };
}

// Usage
class MyPluginService {
  @requiresPermission(Capability.DATABASE_WRITE)
  async createUser(context: PluginExecutionContext, userData: any) {
    // Implementation
  }
}
```

### Input Validation & Sanitization

```typescript
import { sanitizeHTML, validatePluginName, sanitizePluginConfig } from '@monorepo/shared';

// Always sanitize user input
export function processUserInput(input: string): string {
  return sanitizeHTML(input);
}

// Validate plugin-specific data
export function validateConfig(config: Record<string, unknown>): boolean {
  const sanitized = sanitizePluginConfig(config);
  // Additional validation logic
  return true;
}
```

### Query Isolation

```typescript
import { IsolationEnforcer, DatabaseOperation } from '@monorepo/shared';

const enforcer = new IsolationEnforcer({
  allowCrossPluginQueries: false,
  allowSystemSchemaAccess: false,
  maxQueryComplexity: 1000,
  maxExecutionTime: 30000,
  allowedOperations: [
    DatabaseOperation.SELECT,
    DatabaseOperation.INSERT,
    DatabaseOperation.UPDATE,
    DatabaseOperation.DELETE,
  ],
});

// Validate queries before execution
export function validateQuery(query: string, pluginId: string) {
  const result = enforcer.validateQuery(query, pluginId);
  if (!result.valid) {
    throw new Error(`Invalid query: ${result.errors.join(', ')}`);
  }
  return result;
}
```

## API Integration

### Plugin Execution Context

Your plugin receives a rich execution context:

```typescript
interface PluginExecutionContext {
  pluginId: string;
  manifest: PluginManifest;
  pluginPath: string;
  dataPath: string;
  config?: Record<string, unknown>;
  logger: PluginLogger;
  api: PluginAPI;
  storage: PluginStorage;
  db?: Pool; // PostgreSQL connection pool (optional)
  app?: Application; // Express app instance (optional)
}
```

### Making External API Calls

```typescript
export async function callExternalAPI(context: PluginExecutionContext) {
  try {
    const response = await context.api.get('https://api.example.com/data', {
      headers: {
        Authorization: `Bearer ${context.config?.apiKey}`,
      },
      timeout: 5000,
      retries: 3,
    });

    context.logger.info('API call successful', {
      endpoint: 'https://api.example.com/data',
      status: response.status,
    });

    return response.data;
  } catch (error) {
    context.logger.error('API call failed', error, {
      endpoint: 'https://api.example.com/data',
    });
    throw error;
  }
}
```

### Plugin Storage

```typescript
export async function storeData(context: PluginExecutionContext, key: string, data: any) {
  await context.storage.set(key, data);
  context.logger.info('Data stored', { key });
}

export async function retrieveData(context: PluginExecutionContext, key: string) {
  const data = await context.storage.get(key);
  if (data) {
    context.logger.info('Data retrieved', { key });
  } else {
    context.logger.warn('Data not found', { key });
  }
  return data;
}
```

## Theme System

### Frontend Themes

```typescript
import { FrontendTheme, ThemeColors } from '@monorepo/shared';

const myTheme: FrontendTheme = {
  name: 'My Custom Theme',
  version: '1.0.0',
  author: 'Plugin Developer',
  colors: {
    primary: '#2563eb',
    secondary: '#7c3aed',
    background: '#ffffff',
    surface: '#f8fafc',
    text: {
      primary: '#0f172a',
      secondary: '#475569',
    },
    error: '#dc2626',
    warning: '#d97706',
    info: '#0284c7',
    success: '#059669',
  },
  typography: {
    fontFamily: {
      base: '"Inter", sans-serif',
      heading: '"Inter", sans-serif',
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    unit: 4,
    scale: {
      xs: '0.25rem',
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
      '2xl': '3rem',
    },
  },
};
```

### Backend Themes

```typescript
import { BackendTheme, TemplateDefinition } from '@monorepo/shared';

const backendTheme: BackendTheme = {
  name: 'Admin Dashboard Theme',
  version: '1.0.0',
  templates: {
    dashboard: {
      path: 'templates/dashboard.hbs',
      layout: 'admin',
      metadata: {
        title: 'Dashboard',
        description: 'Main admin dashboard',
        category: 'admin',
      },
    },
  },
  layouts: {
    admin: {
      path: 'layouts/admin.hbs',
      regions: ['header', 'sidebar', 'content', 'footer'],
    },
  },
};
```

## Development Workflow

### 1. Project Setup

```bash
# Create plugin directory
mkdir my-awesome-plugin
cd my-awesome-plugin

# Initialize npm project
npm init -y

# Install dependencies
npm install typescript @types/node
npm install --save-dev @monorepo/shared
```

### 2. TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 3. Plugin Entry Point

```typescript
// src/index.ts
import { PluginExecutionContext, PluginLifecycleHooks } from '@monorepo/shared';

export default class MyAwesomePlugin implements PluginLifecycleHooks {
  async onInstall(context: PluginExecutionContext): Promise<void> {
    context.logger.info('Plugin installed successfully');
    // Run installation logic
  }

  async onActivate(context: PluginExecutionContext): Promise<void> {
    context.logger.info('Plugin activated');
    // Initialize plugin services
  }

  async onDeactivate(context: PluginExecutionContext): Promise<void> {
    context.logger.info('Plugin deactivated');
    // Cleanup active processes
  }

  async onUninstall(context: PluginExecutionContext): Promise<void> {
    context.logger.info('Plugin uninstalled');
    // Cleanup data and resources
  }

  async onUpdate(context: PluginExecutionContext, oldVersion: string): Promise<void> {
    context.logger.info(`Plugin updated from ${oldVersion} to ${context.manifest.version}`);
    // Run migration logic
  }
}
```

### 4. Build and Package

```json
// package.json scripts
{
  "scripts": {
    "build": "tsc",
    "clean": "rimraf dist",
    "package": "npm run build && tar -czf plugin.tar.gz dist/ plugin.yaml package.json"
  }
}
```

## Best Practices

### 1. Error Handling

```typescript
export async function safeOperation(context: PluginExecutionContext) {
  try {
    // Your plugin logic here
    const result = await riskyOperation();
    return result;
  } catch (error) {
    context.logger.error('Operation failed', error, {
      operation: 'safeOperation',
      pluginId: context.pluginId,
    });

    // Return safe fallback or rethrow as appropriate
    throw new Error(`Plugin operation failed: ${error.message}`);
  }
}
```

### 2. Configuration Validation

```typescript
import { validatePluginConfig } from '@monorepo/shared';

export function validateSettings(config: Record<string, unknown>): boolean {
  // Use built-in validation
  const sanitized = validatePluginConfig(config);

  // Add custom validation
  if (config.apiKey && typeof config.apiKey !== 'string') {
    throw new Error('API key must be a string');
  }

  return true;
}
```

### 3. Resource Management

```typescript
export class PluginResourceManager {
  private connections: Set<PluginDatabaseConnection> = new Set();

  async getConnection(context: PluginExecutionContext) {
    const connection = await context.database.getConnection();
    this.connections.add(connection);
    return connection;
  }

  async cleanup() {
    for (const connection of this.connections) {
      await connection.close();
    }
    this.connections.clear();
  }
}
```

### 4. Testing

```typescript
// tests/plugin.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';
import MyAwesomePlugin from '../src/index';

describe('MyAwesomePlugin', () => {
  let plugin: MyAwesomePlugin;
  let mockContext: PluginExecutionContext;

  beforeEach(() => {
    plugin = new MyAwesomePlugin();
    mockContext = createMockContext();
  });

  it('should install successfully', async () => {
    await expect(plugin.onInstall(mockContext)).resolves.not.toThrow();
  });

  it('should activate successfully', async () => {
    await expect(plugin.onActivate(mockContext)).resolves.not.toThrow();
  });
});
```

## Examples

### Simple Data Storage Plugin

```typescript
// src/storage-plugin.ts
import { PluginExecutionContext } from '@monorepo/shared';

export class StoragePlugin {
  async storeUserPreference(context: PluginExecutionContext, userId: string, preferences: any) {
    const key = `user_preferences_${userId}`;
    await context.storage.set(key, preferences);

    context.logger.info('User preferences stored', {
      userId,
      preferencesCount: Object.keys(preferences).length,
    });
  }

  async getUserPreferences(context: PluginExecutionContext, userId: string) {
    const key = `user_preferences_${userId}`;
    const preferences = await context.storage.get(key);

    if (preferences) {
      context.logger.info('User preferences retrieved', { userId });
    } else {
      context.logger.warn('No preferences found for user', { userId });
    }

    return preferences || {};
  }
}
```

### API Integration Plugin

```typescript
// src/api-plugin.ts
import { PluginExecutionContext } from '@monorepo/shared';

export class WeatherPlugin {
  async getCurrentWeather(context: PluginExecutionContext, city: string) {
    const apiKey = context.config?.apiKey as string;
    if (!apiKey) {
      throw new Error('Weather API key not configured');
    }

    try {
      // Build URL with properly encoded parameters to handle spaces and special characters
      const params = new URLSearchParams({
        q: city,
        appid: apiKey,
      });
      const url = `https://api.openweathermap.org/data/2.5/weather?${params.toString()}`;

      const response = await context.api.get(url, {
        timeout: 5000,
        retries: 2,
      });

      context.logger.info('Weather data retrieved', { city });
      return response.data;
    } catch (error) {
      context.logger.error('Failed to get weather data', error, { city });
      throw error;
    }
  }
}
```

## System Integration

### Environment Variables

The platform provides these environment variables to your plugin runtime:

- `PLUGIN_ID` - Your plugin's unique identifier
- `PLUGIN_DATA_PATH` - Path to plugin-specific data directory
- `DATABASE_URL` - Database connection string (scoped to your schema)
- `NODE_ENV` - Environment (development/production)

### File System Access

Plugins have access to:

- Plugin directory (read-only)
- Data directory (read/write) at `/app/data/plugins/{plugin-id}/`
- Temporary directory (read/write) at `/app/temp/plugins/{plugin-id}/`

### Network Restrictions

In production, plugins are restricted to:

- Outbound HTTPS connections on standard ports
- Connections to approved external APIs only
- No direct database connections outside the plugin schema

---

For more information and updates, please refer to the [system documentation](./SYSTEM_ARCHITECTURE.md) and the [API reference](./API_REFERENCE.md).
