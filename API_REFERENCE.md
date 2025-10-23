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

### Authentication Methods

The platform supports two authentication methods depending on the client type:

#### 1. Cookie-Based Authentication (Recommended for Web Clients)

The primary authentication method for browser-based clients. After successful login, `accessToken` and `refreshToken` are set as secure HTTP-only cookies.

**Authentication Flow:**
1. Login via `/api/auth/login` (tokens set automatically as cookies)
2. Subsequent requests automatically include cookies
3. No Authorization header needed when using cookies
4. Refresh tokens automatically rotate on `/api/auth/refresh`

**Cookie Configuration:**
- `accessToken`: HTTP-only, SameSite (configurable via `COOKIE_SAMESITE` env), secure in production
- `refreshToken`: HTTP-only, SameSite (configurable), secure in production, 30-day expiry
- See `COOKIE_SAMESITE` in `.env.example` for configuration options (lax/strict/none)

#### 2. Header-Based Authentication (API Clients & Mobile)

For non-browser clients (mobile apps, server-to-server), tokens can be sent via Authorization header:

```
Authorization: Bearer <jwt_token>
```

**API Gateway Behavior:**
- The API Gateway (`/api/*`) enforces JWT verification via the `Authorization` header
- The gateway does NOT parse or forward cookies to downstream services
- For cookie-based clients, the main-app backend handles cookie extraction directly
- Gateway sets `X-User-Id`, `X-User-Role`, `X-User-Email` headers after JWT verification for downstream services

**Security Note:** Downstream services (main-app, python-service) MUST run on a private network and trust `X-User-*` headers only from the gateway.

### Getting Tokens

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response (Cookie-Based Clients):**

```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "role": "admin"
  }
}
```

*Cookies `accessToken` and `refreshToken` are set automatically in response headers.*

**Response (Header-Based Clients):**

Same JSON response, but you must extract tokens from the response body if needed for manual storage.

### Refreshing Tokens

**Cookie-Based:**

```http
POST /api/auth/refresh
```

*Reads `refreshToken` from cookie, returns new tokens as cookies.*

**Header-Based:**

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "rt_abc123..."
}
```

*Returns new `accessToken` and `refreshToken` in response body.*

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
GET /api/users?page=1&limit=20&role=admin&email=john&username=doe
Authorization: Bearer <token>
```

**Query Parameters:**

- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `role` (string): Filter by role (e.g., `admin`, `editor`, `viewer`)
- `active` (boolean): Filter by active status (e.g., `true`, `false`)
- `email` (string): Search by email (partial match, case-insensitive)
- `username` (string): Search by username (partial match, case-insensitive)
- `search` (string): Legacy parameter - searches both email and username (ignored if `email` or `username` specified)

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

> **Note:** Plugin Management REST API is not yet implemented. Plugin management is currently only available through the admin web UI at `/admin/plugins` (requires admin role and authentication).

#### List Plugins

```http
GET /api/plugins?status=active&page=1&limit=20
Authorization: Bearer <token>
```

**Status:** Not yet implemented

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

### File Uploads

#### Upload File

Upload files with automatic magic-byte validation to prevent malicious file uploads.

```http
POST /api/uploads
Authorization: Bearer <token>
Content-Type: multipart/form-data

file=@/path/to/file.jpg
```

**Request:**

- `file` (file): The file to upload (form-data field name must be "file")

**Validation:**

The system performs multi-layer file validation:

1. **Extension Check**: Verifies file extension is in allowed list
2. **MIME Type Check**: Validates MIME type from client
3. **Magic Byte Validation**: Reads first 4100 bytes to detect actual file type
4. **Content Match**: Ensures file extension matches detected content type

**Allowed File Types** (configurable via `ALLOWED_FILE_TYPES` env):

- Images: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- Documents: `application/pdf`

**Response (Success):**

```json
{
  "message": "File uploaded successfully",
  "file": {
    "filename": "1234567890_myfile.jpg",
    "mimetype": "image/jpeg",
    "size": 524288,
    "path": "1234567890_myfile.jpg"
  }
}
```

**Response (Validation Failed):**

```json
{
  "error": "Invalid file content",
  "details": "Detected MIME type \"application/x-executable\" is not in allowed types list",
  "detectedMime": "application/x-executable"
}
```

**Security Features:**

- **Magic Byte Sniffing**: Detects actual file type regardless of extension
- **Automatic Cleanup**: Invalid files are deleted immediately
- **Size Limits**: Configurable max size (default: 10MB via `UPLOAD_MAX_SIZE`)
- **Filename Sanitization**: Removes path traversal and special characters
- **Timestamp Prefix**: Prevents filename collisions

**Developer Notes:**

The `validateUploadedFile` middleware can be applied to any route with multer:

```typescript
router.post('/upload', uploadMiddleware.single('file'), validateUploadedFile, handler);
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
  db?: Pool; // PostgreSQL connection pool (optional)
  app?: Application; // Express app instance (optional)
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
    timestamp: Date.now(),
  });

  try {
    // Plugin logic here
    context.logger.debug('Processing data', { recordCount: 100 });
  } catch (error) {
    context.logger.error('Plugin function failed', error, {
      operation: 'myPluginFunction',
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
    const apiKey = String(context.config?.apiKey || '');
    const params = new URLSearchParams({
      q: city,
      appid: apiKey,
    });
    const url = `https://api.openweathermap.org/data/2.5/weather?${params.toString()}`;

    const response = await context.api.get(url, {
      timeout: 5000,
      retries: 3,
      headers: {
        'User-Agent': 'KevinAlthaus-Plugin/1.0',
      },
    });

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
export async function cacheWeatherData(context: PluginExecutionContext, city: string, data: any) {
  const cacheKey = `weather_${city}_${Date.now()}`;

  await context.storage.set(cacheKey, {
    data,
    timestamp: Date.now(),
    city,
  });

  context.logger.info('Weather data cached', { city, cacheKey });
}

export async function getCachedWeatherData(
  context: PluginExecutionContext,
  city: string
): Promise<any> {
  const keys = await context.storage.keys();
  const weatherKeys = keys.filter((key) => key.startsWith(`weather_${city}_`));

  // Get the most recent cache entry
  if (weatherKeys.length > 0) {
    const latestKey = weatherKeys.sort().pop();
    const cached = await context.storage.get(latestKey);

    if (cached && Date.now() - cached.timestamp < 3600000) {
      // 1 hour
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
    const result = await context.db.execute(sql, [userId, JSON.stringify(preferences)]);

    context.logger.info('User preferences saved', {
      userId,
      preferenceCount: Object.keys(preferences).length,
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
  await context.db.transaction(async (trx) => {
    // Get data from source user
    const userData = await trx.query('SELECT * FROM user_data WHERE user_id = $1', [fromUserId]);

    // Insert data for target user
    for (const record of userData) {
      await trx.execute(
        'INSERT INTO user_data (user_id, data_type, data_value) VALUES ($1, $2, $3)',
        [toUserId, record.data_type, record.data_value]
      );
    }

    // Delete data from source user
    await trx.execute('DELETE FROM user_data WHERE user_id = $1', [fromUserId]);

    context.logger.info('User data transferred successfully', {
      fromUserId,
      toUserId,
      recordCount: userData.length,
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

> **Note:** ThemeAPI is not yet implemented. The `context.themeAPI` property is not available in `PluginExecutionContext`.

```typescript
interface ThemeAPI {
  registerTheme(theme: PluginTheme): Promise<void>;
  unregisterTheme(themeId: string): Promise<void>;
  getActiveTheme(): Promise<PluginTheme | null>;
  compileTheme(theme: PluginTheme): Promise<CompiledTheme>;
}
```

**Usage Example (Planned):**

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
    },
  };

  // await context.themeAPI.registerTheme(theme);  // NOT YET AVAILABLE - themeAPI will be added in future release
  context.logger.info('Theme configuration prepared', { themeId: theme.id });
  // When themeAPI is available, uncomment the line above to register the theme
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

| Code                      | Status | Description                               |
| ------------------------- | ------ | ----------------------------------------- |
| `VALIDATION_ERROR`        | 400    | Invalid input data                        |
| `AUTHENTICATION_REQUIRED` | 401    | Missing or invalid authentication         |
| `PERMISSION_DENIED`       | 403    | Insufficient permissions                  |
| `RESOURCE_NOT_FOUND`      | 404    | Requested resource not found              |
| `CONFLICT`                | 409    | Resource conflict (e.g., duplicate email) |
| `RATE_LIMIT_EXCEEDED`     | 429    | Too many requests                         |
| `INTERNAL_ERROR`          | 500    | Internal server error                     |
| `SERVICE_UNAVAILABLE`     | 503    | Service temporarily unavailable           |

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
    throw new PluginError('Email is required', 'MISSING_EMAIL', 400, { field: 'email' });
  }

  if (!isValidEmail(data.email)) {
    throw new PluginError('Invalid email format', 'INVALID_EMAIL', 400, {
      field: 'email',
      value: data.email,
    });
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
          retryAfter,
        });

        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
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

## Security & Performance

### CSRF Protection

The platform implements multi-layered CSRF protection for state-changing operations:

1. **Double-Submit Cookie Pattern**: CSRF tokens validated on POST/PUT/DELETE/PATCH requests
2. **Origin/Referer Validation**: Requests must originate from allowed origins
3. **Content-Type Restrictions**: Only allows `application/x-www-form-urlencoded`, `application/json`, and `multipart/form-data`
4. **Timing-Safe Comparison**: Prevents timing attacks on token comparison

**Configuration:**

- `CSRF_SECRET`: Secret for signing CSRF tokens (required in production)
- `CSRF_SECRET_FILE`: File path to persist secret in development (default: `.csrf-secret`)

### Refresh Token Security

Refresh tokens are bound to request context to detect token theft:

1. **User Agent Binding**: Tokens tied to the User-Agent header
2. **IP Address Tracking**: Original IP address stored for audit purposes
3. **Automatic Revocation**: Tokens automatically revoked on user agent mismatch
4. **Token Rotation**: New refresh token issued on each use

**Security Warnings:**

Refresh token validation failures with user agent mismatches are logged as potential token theft. All such tokens are automatically revoked.

### Database Query Logging

Database queries are logged with configurable sampling to reduce production log noise while maintaining observability.

**Configuration:**

- `LOG_LEVEL`: Controls logging verbosity
  - `debug`: Log all queries
  - `info` (default): Use sampling for successful queries
  - `warn`/`error`: Use sampling, only log warnings/errors
- `QUERY_LOG_SAMPLE_RATE`: Log every Nth successful query (default: 10)

**Security Features:**

- **SQL Sanitization**: Query text never logged, only hash fingerprint
- **Error Sanitization**: SQL fragments stripped from error messages
- **Parameter Masking**: Query parameters never logged to prevent credential leakage

**Example Logs:**

```json
{
  "message": "[DB] Query executed",
  "queryHash": "a1b2c3d4e5f6",
  "duration": "12ms",
  "rowCount": 5
}
```

### Cookie Security

Authentication cookies use configurable SameSite attributes for CSRF protection:

**Cookie Attributes:**

- `httpOnly: true` - Prevents JavaScript access
- `secure: true` - Enforced in production or when `sameSite=none`
- `sameSite` - Configurable via `COOKIE_SAMESITE` env variable

**SameSite Options:**

- `lax` (default): Best for most cases, allows cookies on top-level navigation
- `strict`: Maximum CSRF protection, blocks all cross-site cookie sending
- `none`: Required for cross-domain scenarios (requires HTTPS)

### PostgreSQL Configuration

**SSL/TLS:**

Configure PostgreSQL SSL mode via `PGSSLMODE` environment variable:

- `disable`: No SSL (development only)
- `prefer` (default for dev): Attempts SSL but falls back
- `require`: Requires SSL (recommended for production)
- `verify-ca`: Requires SSL and verifies CA
- `verify-full`: Requires SSL and verifies hostname

**Migration Locking:**

Database migrations use PostgreSQL advisory locks to prevent concurrent execution:

- Lock ID derived from `MIGRATION_LOCK_NAMESPACE` (default: `kevinalthaus-com-oct`)
- SHA256 hash ensures unique lock IDs per application
- Supports multiple applications sharing the same database

---

For more detailed examples and advanced usage patterns, refer to the [Plugin Development Guide](./PLUGIN_DEVELOPMENT_GUIDE.md) and [System Architecture](./SYSTEM_ARCHITECTURE.md) documentation.
