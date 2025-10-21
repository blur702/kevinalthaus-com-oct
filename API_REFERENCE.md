# API Reference

## Overview

This document provides a comprehensive reference for all APIs available in the Kevin Althaus platform, including both system APIs and plugin development interfaces.

## Table of Contents

1. [Authentication](#authentication)
2. [Core System APIs](#core-system-apis)
3. [Plugin Development APIs](#plugin-development-apis)
4. [Database APIs](#database-apis)
5. [Theme System APIs](#theme-system-apis)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)
8. [Response Formats](#response-formats)

## Authentication

### JWT Authentication

All API requests require a valid JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### Getting a Token

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "rt_abc123...",
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "role": "admin"
    },
    "expiresIn": 3600
  }
}
```

### Refreshing Tokens

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "rt_abc123..."
}
```

## Core System APIs

### Health Check

Check the health status of services.

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "api-gateway",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "uptime": 3600
}
```

### User Management

#### Get Current User

```http
GET /api/users/me
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "user@example.com",
    "username": "johndoe",
    "role": "admin",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "lastLogin": "2024-01-15T10:00:00.000Z"
  }
}
```

#### List Users

```http
GET /api/users?page=1&limit=20&role=admin
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `role` (string): Filter by role
- `search` (string): Search by username or email

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user-uuid",
        "email": "user@example.com",
        "username": "johndoe",
        "role": "admin",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "isActive": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

#### Create User

```http
POST /api/users
Content-Type: application/json
Authorization: Bearer <token>

{
  "email": "newuser@example.com",
  "username": "newuser",
  "password": "secure_password",
  "role": "editor"
}
```

#### Update User

```http
PUT /api/users/:userId
Content-Type: application/json
Authorization: Bearer <token>

{
  "email": "updated@example.com",
  "role": "admin",
  "isActive": true
}
```

#### Delete User

```http
DELETE /api/users/:userId
Authorization: Bearer <token>
```

### Plugin Management

#### List Plugins

```http
GET /api/plugins?status=active&page=1&limit=20
Authorization: Bearer <token>
```

**Query Parameters:**
- `status` (string): Filter by status (installed, active, inactive, error)
- `capabilities` (string): Filter by capabilities (comma-separated)
- `search` (string): Search by name or description

**Response:**
```json
{
  "success": true,
  "data": {
    "plugins": [
      {
        "id": "plugin-uuid",
        "name": "weather-plugin",
        "displayName": "Weather Plugin",
        "version": "1.2.0",
        "description": "Provides weather information",
        "author": {
          "name": "Plugin Developer",
          "email": "dev@example.com"
        },
        "status": "active",
        "capabilities": ["api:call", "database:read"],
        "installedAt": "2024-01-01T00:00:00.000Z",
        "activatedAt": "2024-01-01T00:05:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 25,
      "totalPages": 2
    }
  }
}
```

#### Get Plugin Details

```http
GET /api/plugins/:pluginId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "plugin-uuid",
    "name": "weather-plugin",
    "displayName": "Weather Plugin",
    "version": "1.2.0",
    "description": "Provides comprehensive weather information",
    "author": {
      "name": "Plugin Developer",
      "email": "dev@example.com",
      "url": "https://example.com"
    },
    "manifest": {
      "capabilities": ["api:call", "database:read"],
      "settings": {
        "schema": {
          "apiKey": {
            "type": "string",
            "label": "API Key",
            "required": true
          }
        }
      }
    },
    "status": "active",
    "config": {
      "apiKey": "***"
    },
    "installedAt": "2024-01-01T00:00:00.000Z",
    "activatedAt": "2024-01-01T00:05:00.000Z",
    "stats": {
      "requestCount": 1520,
      "errorCount": 12,
      "lastUsed": "2024-01-15T09:45:00.000Z"
    }
  }
}
```

#### Install Plugin

```http
POST /api/plugins/install
Content-Type: multipart/form-data
Authorization: Bearer <token>

{
  "file": <plugin-package.tar.gz>
}
```

#### Update Plugin Configuration

```http
PUT /api/plugins/:pluginId/config
Content-Type: application/json
Authorization: Bearer <token>

{
  "apiKey": "new-api-key",
  "maxRequests": 1000
}
```

#### Activate/Deactivate Plugin

```http
POST /api/plugins/:pluginId/activate
Authorization: Bearer <token>
```

```http
POST /api/plugins/:pluginId/deactivate
Authorization: Bearer <token>
```

#### Uninstall Plugin

```http
DELETE /api/plugins/:pluginId
Authorization: Bearer <token>
```

### System Settings

#### Get Settings

```http
GET /api/settings
Authorization: Bearer <token>
```

#### Update Settings

```http
PUT /api/settings
Content-Type: application/json
Authorization: Bearer <token>

{
  "siteName": "Kevin Althaus",
  "siteDescription": "Full Stack Developer",
  "maintenanceMode": false,
  "pluginSystemEnabled": true
}
```

## Plugin Development APIs

### Plugin Execution Context

When your plugin is executed, it receives a context object with the following API:

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
  database: PluginDatabaseConnection;
  permissions: PermissionContext;
}
```

### Plugin Logger API

```typescript
interface PluginLogger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, error?: Error, metadata?: Record<string, unknown>): void;
}
```

**Usage Example:**
```typescript
export function myPluginFunction(context: PluginExecutionContext) {
  context.logger.info('Plugin function started', { 
    pluginId: context.pluginId,
    timestamp: Date.now()
  });

  try {
    // Plugin logic here
    context.logger.debug('Processing data', { recordCount: 100 });
  } catch (error) {
    context.logger.error('Plugin function failed', error, {
      operation: 'myPluginFunction'
    });
  }
}
```

### Plugin HTTP API

```typescript
interface PluginAPI {
  get(url: string, options?: RequestOptions): Promise<any>;
  post(url: string, data?: any, options?: RequestOptions): Promise<any>;
  put(url: string, data?: any, options?: RequestOptions): Promise<any>;
  delete(url: string, options?: RequestOptions): Promise<any>;
}

interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}
```

**Usage Example:**
```typescript
export async function fetchWeatherData(context: PluginExecutionContext, city: string) {
  try {
    const response = await context.api.get(
      `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${context.config?.apiKey}`,
      {
        timeout: 5000,
        retries: 3,
        headers: {
          'User-Agent': 'KevinAlthaus-Plugin/1.0'
        }
      }
    );

    context.logger.info('Weather data fetched successfully', { city });
    return response.data;
  } catch (error) {
    context.logger.error('Failed to fetch weather data', error, { city });
    throw error;
  }
}
```

### Plugin Storage API

```typescript
interface PluginStorage {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}
```

**Usage Example:**
```typescript
export async function cacheWeatherData(
  context: PluginExecutionContext, 
  city: string, 
  data: any
) {
  const cacheKey = `weather_${city}_${Date.now()}`;
  
  await context.storage.set(cacheKey, {
    data,
    timestamp: Date.now(),
    city
  });

  context.logger.info('Weather data cached', { city, cacheKey });
}

export async function getCachedWeatherData(
  context: PluginExecutionContext, 
  city: string
): Promise<any> {
  const keys = await context.storage.keys();
  const weatherKeys = keys.filter(key => key.startsWith(`weather_${city}_`));
  
  // Get the most recent cache entry
  if (weatherKeys.length > 0) {
    const latestKey = weatherKeys.sort().pop();
    const cached = await context.storage.get(latestKey);
    
    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour
      context.logger.info('Using cached weather data', { city });
      return cached.data;
    }
  }

  return null;
}
```

## Database APIs

### Plugin Database Connection

```typescript
interface PluginDatabaseConnection {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;
  transaction<T>(callback: (trx: Transaction) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

interface QueryResult {
  rowCount: number;
  insertId?: number | string;
  affectedRows?: number;
}
```

**Usage Example:**
```typescript
export async function createUserPreference(
  context: PluginExecutionContext,
  userId: string,
  preferences: Record<string, unknown>
) {
  const sql = `
    INSERT INTO user_preferences (user_id, preferences, created_at)
    VALUES ($1, $2, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id) 
    DO UPDATE SET preferences = $2, updated_at = CURRENT_TIMESTAMP
    RETURNING id
  `;

  try {
    const result = await context.database.execute(sql, [userId, JSON.stringify(preferences)]);
    
    context.logger.info('User preferences saved', { 
      userId, 
      preferenceCount: Object.keys(preferences).length 
    });

    return result.insertId;
  } catch (error) {
    context.logger.error('Failed to save user preferences', error, { userId });
    throw error;
  }
}
```

### Database Transactions

```typescript
export async function transferUserData(
  context: PluginExecutionContext,
  fromUserId: string,
  toUserId: string
) {
  await context.database.transaction(async (trx) => {
    // Get data from source user
    const userData = await trx.query(
      'SELECT * FROM user_data WHERE user_id = $1',
      [fromUserId]
    );

    // Insert data for target user
    for (const record of userData) {
      await trx.execute(
        'INSERT INTO user_data (user_id, data_type, data_value) VALUES ($1, $2, $3)',
        [toUserId, record.data_type, record.data_value]
      );
    }

    // Delete data from source user
    await trx.execute(
      'DELETE FROM user_data WHERE user_id = $1',
      [fromUserId]
    );

    context.logger.info('User data transferred successfully', {
      fromUserId,
      toUserId,
      recordCount: userData.length
    });
  });
}
```

## Theme System APIs

### Theme Management

#### List Themes

```http
GET /api/themes?type=frontend&active=true
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "themes": [
      {
        "id": "theme-uuid",
        "name": "modern-dark",
        "displayName": "Modern Dark",
        "version": "1.0.0",
        "type": "frontend",
        "author": "Theme Developer",
        "isActive": true,
        "screenshots": ["/themes/modern-dark/screenshot1.png"],
        "installedAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

#### Apply Theme

```http
POST /api/themes/:themeId/apply
Authorization: Bearer <token>
```

### Theme Development API

```typescript
interface ThemeAPI {
  registerTheme(theme: PluginTheme): Promise<void>;
  unregisterTheme(themeId: string): Promise<void>;
  getActiveTheme(): Promise<PluginTheme | null>;
  compileTheme(theme: PluginTheme): Promise<CompiledTheme>;
}
```

**Usage Example:**
```typescript
export async function registerMyTheme(context: PluginExecutionContext) {
  const theme: PluginTheme = {
    id: `${context.pluginId}-theme`,
    pluginId: context.pluginId,
    name: 'My Custom Theme',
    version: '1.0.0',
    type: 'frontend',
    frontend: {
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
          secondary: '#475569'
        },
        error: '#dc2626',
        warning: '#d97706',
        info: '#0284c7',
        success: '#059669'
      },
      typography: {
        fontFamily: {
          base: '"Inter", sans-serif'
        },
        fontSize: {
          xs: '0.75rem',
          sm: '0.875rem',
          base: '1rem',
          lg: '1.125rem',
          xl: '1.25rem',
          '2xl': '1.5rem',
          '3xl': '1.875rem'
        },
        fontWeight: {
          light: 300,
          normal: 400,
          medium: 500,
          semibold: 600,
          bold: 700
        },
        lineHeight: {
          tight: 1.25,
          normal: 1.5,
          relaxed: 1.75
        }
      },
      spacing: {
        unit: 4,
        scale: {
          xs: '0.25rem',
          sm: '0.5rem',
          md: '1rem',
          lg: '1.5rem',
          xl: '2rem',
          '2xl': '3rem'
        }
      }
    }
  };

  await context.themeAPI.registerTheme(theme);
  context.logger.info('Theme registered successfully', { themeId: theme.id });
}
```

## Error Handling

### Standard Error Response

All API errors follow this format:

```json
{
  "success": false,
  "error": "ValidationError",
  "message": "Invalid input data",
  "details": {
    "field": "email",
    "code": "INVALID_EMAIL",
    "value": "invalid-email"
  },
  "statusCode": 400,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req-123456"
}
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `AUTHENTICATION_REQUIRED` | 401 | Missing or invalid authentication |
| `PERMISSION_DENIED` | 403 | Insufficient permissions |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource not found |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate email) |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

### Plugin Error Handling

```typescript
export class PluginError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'PluginError';
  }
}

// Usage in plugins
export function validatePluginInput(data: any) {
  if (!data.email) {
    throw new PluginError(
      'Email is required',
      'MISSING_EMAIL',
      400,
      { field: 'email' }
    );
  }

  if (!isValidEmail(data.email)) {
    throw new PluginError(
      'Invalid email format',
      'INVALID_EMAIL',
      400,
      { field: 'email', value: data.email }
    );
  }
}
```

## Rate Limiting

### Default Limits

- **API Gateway**: 100 requests per 15 minutes per IP
- **Plugin APIs**: 1000 requests per hour per plugin
- **Database Operations**: 500 queries per minute per plugin

### Rate Limit Headers

Responses include rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1642251600
```

### Handling Rate Limits

```typescript
export async function makeAPICallWithRetry(
  context: PluginExecutionContext,
  url: string,
  options: RequestOptions = {}
) {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await context.api.get(url, options);
    } catch (error) {
      if (error.statusCode === 429) {
        const retryAfter = error.headers['retry-after'] || Math.pow(2, attempt);
        context.logger.warn('Rate limit hit, retrying after delay', {
          attempt,
          retryAfter
        });
        
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        attempt++;
      } else {
        throw error;
      }
    }
  }

  throw new PluginError('Max retries exceeded', 'MAX_RETRIES_EXCEEDED', 429);
}
```

## Response Formats

### Successful Response

```json
{
  "success": true,
  "data": <response_data>,
  "message": "Operation completed successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Paginated Response

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "ErrorType",
  "message": "Human readable error message",
  "details": {
    "field": "fieldName",
    "code": "ERROR_CODE"
  },
  "statusCode": 400,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

For more detailed examples and advanced usage patterns, refer to the [Plugin Development Guide](./PLUGIN_DEVELOPMENT_GUIDE.md) and [System Architecture](./SYSTEM_ARCHITECTURE.md) documentation.