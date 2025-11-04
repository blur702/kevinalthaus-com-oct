# API Endpoints Catalog

This document catalogs all API endpoints discovered in the application.

## API Gateway Routes

All routes go through the API Gateway at `http://localhost:3000` (dev) or `http://localhost:4000` (prod)

### Health Check Endpoints

#### GET /health
- **Authentication**: None
- **Description**: Comprehensive health check with downstream service checks
- **Response**: 200 (healthy) or 503 (degraded)
- **Response Body**:
  ```json
  {
    "status": "healthy" | "degraded",
    "service": "api-gateway",
    "timestamp": "ISO-8601",
    "version": "1.0.0",
    "uptime": number,
    "checks": {
      "mainApp": "healthy" | "unhealthy",
      "pythonService": "healthy" | "unhealthy"
    }
  }
  ```

#### GET /health/live
- **Authentication**: None
- **Description**: Liveness probe for container orchestration
- **Response**: 200
- **Response Body**:
  ```json
  { "status": "alive" }
  ```

#### GET /health/ready
- **Authentication**: None
- **Description**: Readiness probe - checks critical dependencies
- **Response**: 200 (ready) or 503 (not ready)
- **Response Body**:
  ```json
  {
    "status": "ready" | "not ready",
    "dependencies": { "mainApp": "healthy" | "unhealthy" }
  }
  ```

#### GET /
- **Authentication**: None
- **Description**: Root endpoint
- **Response**: 200
- **Response Body**:
  ```json
  {
    "message": "Kevin Althaus API Gateway",
    "version": "1.0.0",
    "environment": "development" | "production"
  }
  ```

---

## Authentication Routes (/api/auth)

**Rate Limited**: 10 requests per 15 minutes in production

### POST /api/auth/register
- **Authentication**: None (public)
- **Description**: Register new user account
- **Request Body**:
  ```json
  {
    "email": "string (required, valid email)",
    "username": "string (required)",
    "password": "string (required, min 8 chars, must contain uppercase, lowercase, digit, special char)"
  }
  ```
- **Response**: 201 (success), 400 (validation error), 409 (conflict)
- **Success Response**:
  ```json
  {
    "message": "User registered successfully",
    "user": {
      "id": "uuid",
      "email": "string",
      "username": "string",
      "role": "viewer"
    }
  }
  ```
- **Sets Cookies**: `accessToken` (15min), `refreshToken` (30 days)

### POST /api/auth/login
- **Authentication**: None (public)
- **Description**: Login with username/email and password
- **Request Body**:
  ```json
  {
    "username": "string (required, can be username or email)",
    "password": "string (required)"
  }
  ```
- **Response**: 200 (success), 400 (validation), 401 (invalid credentials)
- **Success Response**:
  ```json
  {
    "message": "Login successful",
    "user": {
      "id": "uuid",
      "email": "string",
      "username": "string",
      "role": "viewer" | "editor" | "admin"
    }
  }
  ```
- **Sets Cookies**: `accessToken`, `refreshToken`

### POST /api/auth/refresh
- **Authentication**: Requires `refreshToken` cookie
- **Description**: Refresh access token using refresh token
- **Response**: 200 (success), 400 (no token), 401 (invalid/expired token)
- **Success Response**:
  ```json
  { "message": "Token refreshed" }
  ```
- **Sets Cookies**: New `accessToken` and `refreshToken`

### POST /api/auth/logout
- **Authentication**: None (but revokes refreshToken if present)
- **Description**: Logout and revoke refresh token
- **Response**: 200
- **Success Response**:
  ```json
  { "message": "Logout successful" }
  ```
- **Clears Cookies**: `accessToken`, `refreshToken`

### POST /api/auth/forgot-password
- **Authentication**: None
- **Description**: Request password reset email
- **Request Body**:
  ```json
  { "email": "string (required, valid email)" }
  ```
- **Response**: Always 200 (prevents email enumeration)
- **Success Response**:
  ```json
  {
    "message": "If an account exists with this email, a password reset link has been sent"
  }
  ```

### POST /api/auth/reset-password
- **Authentication**: None (requires valid reset token)
- **Description**: Reset password using token from email
- **Request Body**:
  ```json
  {
    "token": "string (required, from email link)",
    "newPassword": "string (required, same validation as register)"
  }
  ```
- **Response**: 200 (success), 400 (invalid token/password)
- **Success Response**:
  ```json
  {
    "message": "Password has been reset successfully. Please login with your new password"
  }
  ```

### POST /api/auth/change-password
- **Authentication**: Required (JWT)
- **Description**: Change password for authenticated user
- **Request Body**:
  ```json
  {
    "currentPassword": "string (required)",
    "newPassword": "string (required)"
  }
  ```
- **Response**: 200 (success), 400 (validation), 401 (wrong current password)
- **Success Response**:
  ```json
  { "message": "Password changed successfully" }
  ```

### GET /api/auth/validate
- **Authentication**: Required (JWT)
- **Description**: Validate JWT token
- **Response**: 200 (valid), 401 (invalid)
- **Success Response**:
  ```json
  {
    "message": "Token is valid",
    "user": { "userId": "uuid", "email": "string", "role": "string" }
  }
  ```

### GET /api/auth/me
- **Authentication**: Required (JWT)
- **Description**: Get current user info from token
- **Response**: 200 (success), 401 (unauthorized)
- **Success Response**:
  ```json
  {
    "user": { "userId": "uuid", "email": "string", "role": "string" }
  }
  ```

---

## User Routes (/api/users)

**Authentication**: Required for all routes
**Authorization**: Varies by endpoint

### GET /api/users
- **Authorization**: Requires `USER_VIEW` capability
- **Description**: List users with pagination and filtering
- **Query Parameters**:
  - `page`: number (default: 1)
  - `limit`: number (default: 10, max: 100)
  - `search`: string (searches email and username)
  - `email`: string (filter by email)
  - `username`: string (filter by username)
  - `role`: "admin" | "editor" | "viewer"
  - `active`: "true" | "false"
- **Response**: 200
- **Success Response**:
  ```json
  {
    "users": [{
      "id": "uuid",
      "email": "string",
      "username": "string",
      "role": "string",
      "created_at": "ISO-8601",
      "last_login": "ISO-8601",
      "is_active": boolean
    }],
    "pagination": {
      "page": number,
      "limit": number,
      "total": number,
      "totalPages": number
    }
  }
  ```

### GET /api/users/:id
- **Authorization**: Requires `USER_VIEW` capability
- **Description**: Get single user by ID
- **Response**: 200 (success), 404 (not found)
- **Success Response**:
  ```json
  {
    "user": {
      "id": "uuid",
      "email": "string",
      "username": "string",
      "role": "string",
      "created_at": "ISO-8601",
      "last_login": "ISO-8601",
      "is_active": boolean
    }
  }
  ```

### POST /api/users
- **Authorization**: Requires ADMIN role
- **Description**: Create new user
- **Request Body**:
  ```json
  {
    "email": "string (required, valid email)",
    "username": "string (required, 3-30 chars, alphanumeric + _ -)",
    "password": "string (required)",
    "role": "admin" | "editor" | "viewer" (optional, default: viewer)
  }
  ```
- **Response**: 201 (success), 400 (validation), 409 (conflict)
- **Success Response**:
  ```json
  {
    "message": "User created successfully",
    "user": {
      "id": "uuid",
      "email": "string",
      "username": "string",
      "role": "string",
      "created_at": "ISO-8601"
    }
  }
  ```

### PATCH /api/users/:id
- **Authorization**: Requires ADMIN role
- **Description**: Update user (partial update)
- **Request Body** (all optional):
  ```json
  {
    "email": "string (valid email)",
    "username": "string (3-30 chars)",
    "role": "admin" | "editor" | "viewer",
    "is_active": boolean
  }
  ```
- **Response**: 200 (success), 400 (validation), 404 (not found), 409 (conflict)
- **Success Response**:
  ```json
  {
    "message": "User updated successfully",
    "user": {
      "id": "uuid",
      "email": "string",
      "username": "string",
      "role": "string",
      "is_active": boolean
    }
  }
  ```

### DELETE /api/users/:id
- **Authorization**: Requires ADMIN role
- **Description**: Delete user (prevents self-deletion)
- **Response**: 200 (success), 400 (self-deletion attempt), 404 (not found)
- **Success Response**:
  ```json
  { "message": "User deleted successfully" }
  ```

---

## Users Manager Routes (/api/users-manager)

**Authentication**: Required
**Authorization**: ADMIN role required for all routes

### GET /api/users-manager
- **Description**: List users with enhanced filtering and sorting
- **Query Parameters**:
  - `page`: number (default: 1)
  - `limit`: number (default: 10, max: 100)
  - `search`: string (searches email and username)
  - `role`: "admin" | "editor" | "viewer"
  - `isActive`: "true" | "false"
  - `sortBy`: "username" | "email" | "role" | "createdAt" | "lastLogin" (default: "createdAt")
  - `sortOrder`: "asc" | "desc" (default: "desc")
- **Response**: 200
- **Success Response**:
  ```json
  {
    "users": [{
      "id": "uuid",
      "email": "string",
      "username": "string",
      "role": "string",
      "createdAt": "ISO-8601",
      "updatedAt": "ISO-8601",
      "lastLogin": "ISO-8601",
      "active": boolean
    }],
    "total": number,
    "page": number,
    "limit": number,
    "totalPages": number
  }
  ```

### GET /api/users-manager/:id
- **Description**: Get single user with full details
- **Response**: 200 (success), 404 (not found)

### POST /api/users-manager
- **Description**: Create new user
- **Request Body**:
  ```json
  {
    "email": "string (required)",
    "username": "string (required)",
    "password": "string (required)",
    "role": "admin" | "editor" | "viewer" (optional, default: viewer),
    "active": boolean (optional, default: true)
  }
  ```
- **Response**: 201 (success), 400 (validation), 409 (conflict)

### PATCH /api/users-manager/:id
- **Description**: Update user
- **Request Body** (all optional):
  ```json
  {
    "email": "string",
    "username": "string",
    "password": "string",
    "role": "admin" | "editor" | "viewer",
    "active": boolean
  }
  ```
- **Response**: 200 (success), 400 (validation), 404 (not found), 409 (conflict)

### DELETE /api/users-manager/:id
- **Description**: Delete user (prevents self-deletion and 'kevin' account deletion)
- **Response**: 200 (success), 400 (self-deletion), 403 (kevin account), 404 (not found)

### GET /api/users-manager/:id/activity
- **Description**: Get user activity audit log
- **Query Parameters**:
  - `limit`: number (default: 50, max: 100)
- **Response**: 200
- **Success Response**:
  ```json
  {
    "activities": [{
      "id": "uuid",
      "userId": "uuid",
      "action": "string",
      "details": "string",
      "timestamp": "ISO-8601"
    }]
  }
  ```

### GET /api/users-manager/:id/custom-fields
- **Description**: Get user custom fields
- **Response**: 200, 404 (user not found), 501 (feature not available)
- **Success Response**:
  ```json
  { "customFields": { /* arbitrary JSON object */ } }
  ```

### PATCH /api/users-manager/:id/custom-fields
- **Description**: Update user custom fields
- **Request Body**:
  ```json
  { "customFields": { /* arbitrary JSON object */ } }
  ```
- **Response**: 200, 400 (validation), 404 (not found), 501 (feature not available)

### POST /api/users-manager/bulk/import
- **Description**: Bulk import users from array
- **Request Body**:
  ```json
  {
    "users": [{
      "email": "string",
      "username": "string",
      "password": "string",
      "role": "string",
      "active": boolean
    }]
  }
  ```
- **Response**: 200
- **Success Response**:
  ```json
  {
    "success": number,
    "failed": number,
    "errors": [{ "index": number, "error": "string" }]
  }
  ```

### POST /api/users-manager/bulk/export
- **Description**: Bulk export users to JSON or CSV
- **Request Body**:
  ```json
  {
    "format": "json" | "csv",
    "userIds": ["uuid"] (optional)
  }
  ```
- **Response**: 200 (downloads file)

### POST /api/users-manager/bulk/delete
- **Description**: Bulk delete users
- **Request Body**:
  ```json
  { "userIds": ["uuid"] }
  ```
- **Response**: 200, 400 (self-deletion), 403 (kevin account)
- **Success Response**:
  ```json
  { "deleted": number }
  ```

---

## Dashboard Routes (/api/dashboard)

**Authentication**: Required
**Authorization**: ADMIN role required for all routes

### GET /api/dashboard/stats
- **Description**: Get dashboard statistics
- **Response**: 200
- **Success Response**:
  ```json
  {
    "totalUsers": number,
    "pageViews": number,
    "articles": number,
    "growth": number,
    "changes": {
      "users": "string (e.g., '+5.2%')",
      "views": "string",
      "articles": "string",
      "growth": "string"
    }
  }
  ```

---

## Analytics Routes (/api/analytics)

**Authentication**: Required
**Authorization**: ADMIN role required for all routes

### GET /api/analytics/page-views
- **Description**: Query page views with filtering and aggregation
- **Query Parameters**:
  - `startDate`: ISO-8601 string
  - `endDate`: ISO-8601 string
  - `path`: string (LIKE filter)
  - `userId`: uuid
  - `limit`: number (default: 100, max: 1000)
  - `offset`: number (default: 0)
  - `groupBy`: "hour" | "day" | "week" | "month" (optional, enables aggregation)
- **Response**: 200, 400 (invalid groupBy)
- **Success Response** (without groupBy):
  ```json
  {
    "success": true,
    "data": [{
      "id": "uuid",
      "url": "string",
      "path": "string",
      "user_id": "uuid | null",
      "ip_address": "string | null",
      "user_agent": "string | null",
      "referrer": "string | null",
      "created_at": "ISO-8601"
    }],
    "pagination": { "limit": number, "offset": number, "total": number },
    "filters": { /* applied filters */ }
  }
  ```
- **Success Response** (with groupBy):
  ```json
  {
    "success": true,
    "data": [{
      "period": "ISO-8601",
      "count": number,
      "unique_users": number
    }],
    "pagination": { "limit": number, "offset": number, "total": number },
    "filters": { /* applied filters */ }
  }
  ```

### GET /api/analytics/page-views/stats
- **Description**: Get page view summary statistics
- **Response**: 200
- **Success Response**:
  ```json
  {
    "success": true,
    "stats": {
      "total_views": number,
      "unique_visitors": number,
      "views_today": number,
      "views_this_week": number,
      "views_this_month": number,
      "top_pages": [{ "path": "string", "views": number }]
    }
  }
  ```

### GET /api/analytics/page-views/top-pages
- **Description**: Get top pages by view count
- **Query Parameters**:
  - `limit`: number (default: 10, max: 100)
  - `startDate`: ISO-8601 string
  - `endDate`: ISO-8601 string
- **Response**: 200
- **Success Response**:
  ```json
  {
    "success": true,
    "data": [{
      "path": "string",
      "views": number,
      "unique_visitors": number
    }],
    "filters": { "limit": number, "startDate": string, "endDate": string }
  }
  ```

---

## Settings Routes (/api/settings)

**Authentication**: Required
**Authorization**: ADMIN role required for all routes

### GET /api/settings/site
- **Description**: Get site configuration settings
- **Response**: 200
- **Success Response**:
  ```json
  {
    "site_name": "string",
    "site_description": "string",
    "site_url": "string",
    "timezone": "string",
    "language": "string"
  }
  ```

### PUT /api/settings/site
- **Description**: Update site configuration settings
- **Request Body**:
  ```json
  {
    "site_name": "string (1-100 chars, optional)",
    "site_description": "string (max 500 chars, optional)",
    "site_url": "string (valid URL, optional)",
    "timezone": "string (optional)",
    "language": "string (optional)"
  }
  ```
- **Validation**:
  - `site_name`: 1-100 characters if provided
  - `site_description`: max 500 characters
  - `site_url`: must be a valid URL format
- **Response**: 200
- **Success Response**: Same as GET response

### GET /api/settings/security
- **Description**: Get security settings including password policies and session settings
- **Response**: 200
- **Success Response**:
  ```json
  {
    "password_min_length": 8,
    "password_require_uppercase": true,
    "password_require_lowercase": true,
    "password_require_numbers": true,
    "password_require_special": false,
    "session_timeout_minutes": 60,
    "max_login_attempts": 5,
    "lockout_duration_minutes": 15,
    "require_2fa": false
  }
  ```

### PUT /api/settings/security
- **Description**: Update security settings
- **Request Body**:
  ```json
  {
    "password_min_length": "number (8-128, optional)",
    "password_require_uppercase": "boolean (optional)",
    "password_require_lowercase": "boolean (optional)",
    "password_require_numbers": "boolean (optional)",
    "password_require_special": "boolean (optional)",
    "session_timeout_minutes": "number (15-1440, optional)",
    "max_login_attempts": "number (3-10, optional)",
    "lockout_duration_minutes": "number (5-60, optional)",
    "require_2fa": "boolean (optional)"
  }
  ```
- **Validation**:
  - `password_min_length`: 8-128
  - `session_timeout_minutes`: 15-1440 minutes
  - `max_login_attempts`: 3-10
  - `lockout_duration_minutes`: 5-60 minutes
- **Response**: 200
- **Success Response**: Same as GET response

### GET /api/settings/email
- **Description**: Get email/SMTP settings (smtp_password excluded for security)
- **Response**: 200
- **Success Response**:
  ```json
  {
    "smtp_host": "string",
    "smtp_port": 587,
    "smtp_secure": false,
    "smtp_user": "string",
    "smtp_from_email": "string",
    "smtp_from_name": "string"
  }
  ```
- **Security Note**: The `smtp_password` field is never returned in GET responses

### PUT /api/settings/email
- **Description**: Update email/SMTP settings
- **Request Body**:
  ```json
  {
    "smtp_host": "string (optional)",
    "smtp_port": "number (1-65535, optional)",
    "smtp_secure": "boolean (optional)",
    "smtp_user": "string (optional)",
    "smtp_password": "string (optional, leave blank to keep existing)",
    "smtp_from_email": "string (valid email, optional)",
    "smtp_from_name": "string (optional)"
  }
  ```
- **Validation**:
  - `smtp_port`: 1-65535
  - `smtp_from_email`: valid email format
- **Security Note**: If `smtp_password` is provided, it is hashed with SHA-256 before storage
- **Response**: 200
- **Success Response**: Same as GET response (smtp_password excluded)

### POST /api/settings/email/test
- **Description**: Test email settings by sending a test email
- **Request Body**: None
- **Response**: 200
- **Success Response**:
  ```json
  {
    "success": true,
    "message": "Test email sent successfully"
  }
  ```
- **Error Response** (settings not configured):
  ```json
  {
    "success": false,
    "message": "Email settings are not configured. Please configure SMTP host and from email first."
  }
  ```

### GET /api/settings/api-keys
- **Description**: Get list of API keys (admins see all, others see only their own)
- **Response**: 200
- **Success Response**:
  ```json
  [
    {
      "id": "uuid",
      "user_id": "uuid",
      "name": "string",
      "key_prefix": "sk_1234abcd",
      "scopes": ["read", "write"],
      "last_used_at": "ISO-8601 | null",
      "expires_at": "ISO-8601 | null",
      "created_at": "ISO-8601"
    }
  ]
  ```
- **Security Note**: Only non-revoked keys are returned. The `key_hash` is never exposed.

### POST /api/settings/api-keys
- **Description**: Create a new API key
- **Request Body**:
  ```json
  {
    "name": "string (3-100 chars, required)",
    "scopes": ["string"] (optional, default: []),
    "expires_at": "ISO-8601 (optional)"
  }
  ```
- **Validation**:
  - `name`: 3-100 characters, required
  - `scopes`: array of strings
  - `expires_at`: valid ISO date if provided
- **Response**: 200
- **Success Response**:
  ```json
  {
    "key": "sk_full_key_here",
    "id": "uuid",
    "user_id": "uuid",
    "name": "string",
    "key_prefix": "sk_1234abcd",
    "scopes": ["read", "write"],
    "last_used_at": null,
    "expires_at": "ISO-8601 | null",
    "created_at": "ISO-8601"
  }
  ```
- **Security Notes**:
  - The full `key` is returned ONLY ONCE during creation
  - The key is generated using 32 random bytes (64-char hex string with 'sk_' prefix)
  - Only the SHA-256 hash of the key is stored in the database
  - API key creation is logged in the audit_log table

### DELETE /api/settings/api-keys/:id
- **Description**: Revoke an API key (soft delete by setting revoked_at timestamp)
- **Authorization**: User must own the key OR be an admin
- **Path Parameters**:
  - `id`: UUID of the API key to revoke
- **Response**: 200
- **Success Response**:
  ```json
  {
    "success": true,
    "message": "API key revoked successfully"
  }
  ```
- **Error Response** (not found):
  ```json
  {
    "error": "API key not found"
  }
  ```
- **Error Response** (unauthorized):
  ```json
  {
    "error": "Not authorized to revoke this API key"
  }
  ```
- **Security Note**: API key revocation is logged in the audit_log table

---

## Blog Routes (/api/blog)

**Authentication**: Required for most routes (public routes explicitly marked)

### GET /api/blog
- **Authentication**: None
- **Description**: List blog posts (all statuses if authenticated, public only if not)
- **Query Parameters**:
  - `page`: number (default: 1)
  - `limit`: number (default: 10)
  - `status`: "draft" | "published" | "scheduled"
- **Response**: 200
- **Success Response**:
  ```json
  {
    "posts": [{
      "id": "uuid",
      "title": "string",
      "slug": "string",
      "body_html": "string",
      "excerpt": "string",
      "meta_description": "string",
      "meta_keywords": "string",
      "author_id": "uuid",
      "author_email": "string",
      "author_display_name": "string",
      "reading_time_minutes": number,
      "allow_comments": boolean,
      "featured_image_id": "uuid | null",
      "status": "string",
      "publish_at": "ISO-8601 | null",
      "published_at": "ISO-8601 | null",
      "created_at": "ISO-8601",
      "updated_at": "ISO-8601"
    }],
    "total": number,
    "page": number,
    "limit": number,
    "total_pages": number
  }
  ```

### GET /api/blog/public
- **Authentication**: None
- **Description**: Get published blog posts only
- **Query Parameters**: `page`, `limit`
- **Response**: 200

### GET /api/blog/:id
- **Authentication**: None
- **Description**: Get single blog post
- **Response**: 200 (success), 404 (not found)

### POST /api/blog
- **Authentication**: Required
- **Description**: Create new blog post
- **Request Body**:
  ```json
  {
    "title": "string (required)",
    "slug": "string (optional, auto-generated from title)",
    "body_html": "string (required)",
    "excerpt": "string (optional)",
    "meta_description": "string (optional)",
    "meta_keywords": "string (optional)",
    "reading_time_minutes": number (optional),
    "allow_comments": boolean (optional, default: true),
    "featured_image_id": "uuid (optional)",
    "status": "draft" | "published" | "scheduled" (optional, default: draft),
    "publish_at": "ISO-8601 (optional)"
  }
  ```
- **Response**: 201 (success), 400 (validation), 409 (slug conflict)

### PUT /api/blog/:id
- **Authentication**: Required
- **Authorization**: Must be author or admin
- **Description**: Update blog post
- **Request Body**: Same as POST (all fields optional)
- **Response**: 200 (success), 400 (validation), 403 (forbidden), 404 (not found), 409 (slug conflict)

### DELETE /api/blog/:id
- **Authentication**: Required
- **Authorization**: Must be author or admin
- **Description**: Soft delete blog post
- **Response**: 200 (success), 403 (forbidden), 404 (not found)

### POST /api/blog/:id/publish
- **Authentication**: Required
- **Authorization**: Must be author, editor, or admin
- **Description**: Publish a draft blog post
- **Response**: 200 (success), 400 (missing required fields), 403 (forbidden), 404 (not found), 409 (already published)

### POST /api/blog/:id/unpublish
- **Authentication**: Required
- **Authorization**: Must be author, editor, or admin
- **Description**: Unpublish a blog post (set to draft)
- **Response**: 200 (success), 403 (forbidden), 404 (not found)

---

## Plugin Management Routes (/api/plugins)

**Authentication**: Required
**Authorization**: ADMIN role required for all routes

### GET /api/plugins
- **Description**: List all plugins (discovered and installed)
- **Response**: 200
- **Success Response**:
  ```json
  {
    "plugins": [{
      "id": "string",
      "name": "string",
      "version": "string",
      "description": "string",
      "status": "active" | "inactive"
    }]
  }
  ```

### POST /api/plugins/upload
- **Description**: Upload plugin package
- **Request**: multipart/form-data
  - `package`: file (required, zip/tar/gzip)
  - `manifest`: JSON string (optional)
  - `signature`: string (optional, base64 signature)
- **Response**: 201 (success), 400 (validation)
- **Success Response**:
  ```json
  {
    "message": "Package uploaded",
    "file": {
      "filename": "string",
      "size": number,
      "mimetype": "string"
    },
    "checksum": "string (SHA-256 hex)",
    "signatureVerified": boolean | undefined,
    "manifest": { /* plugin manifest */ } | undefined
  }
  ```

### POST /api/plugins/:id/install
- **Description**: Install plugin by ID
- **Response**: 200 (success), 400 (invalid ID), 500 (install failed)

### POST /api/plugins/:id/activate
- **Description**: Activate installed plugin
- **Response**: 200 (success), 400 (invalid ID), 500 (activation failed)

### POST /api/plugins/:id/deactivate
- **Description**: Deactivate active plugin
- **Response**: 200 (success), 400 (invalid ID), 500 (deactivation failed)

### POST /api/plugins/:id/uninstall
- **Description**: Uninstall plugin
- **Response**: 200 (success), 400 (invalid ID), 500 (uninstall failed)

---

## Upload Routes (/api/uploads)

**Authentication**: Required (implicitly via middleware)

### POST /api/uploads
- **Description**: Upload file with validation
- **Request**: multipart/form-data
  - `file`: file (required)
- **Response**: 200 (success), 400 (no file/validation failed)
- **Success Response**:
  ```json
  {
    "message": "File uploaded successfully",
    "file": {
      "filename": "string",
      "mimetype": "string",
      "size": number,
      "path": "string"
    }
  }
  ```

---

## Notes

### Rate Limiting
- Auth endpoints: 10 requests per 15 minutes (production)
- General API: Standard rate limiting applies

### Authentication Methods
1. **Cookie-based** (preferred): `accessToken` cookie
2. **Header-based** (fallback): `Authorization: Bearer <token>`

### Error Response Format
All endpoints return errors in this format:
```json
{
  "error": "Error Type",
  "message": "Human-readable error message",
  "statusCode": number (optional)
}
```

### Pagination
Most list endpoints support pagination with:
- `page`: 1-based page number
- `limit`: Results per page (usually max 100)
- Response includes `total`, `totalPages`, `page`, `limit`
