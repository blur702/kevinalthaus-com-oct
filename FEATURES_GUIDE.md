# Features Implementation Guide

## Summary of Implementation

**Status: 12 out of 20 features are COMPLETE and production-ready.**

### ✅ Fully Implemented Features (12/20)

1. **Authentication System** ✅
   - Location: `packages/main-app/src/auth/`
   - Endpoints: `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh`, `/api/auth/logout`, `/api/users/me`
   - JWT-based with refresh token rotation
   - RBAC middleware (`requireRole`, `requireCapability`)

2. **Database Layer** ✅
   - Location: `packages/main-app/src/db/`
   - PostgreSQL with connection pooling
   - Automated migrations on startup
   - Tables: users, refresh_tokens, plugin_registry, system_settings, audit_log, plugin_kv_store

3. **User Management API** ✅
   - Location: `packages/main-app/src/users/`
   - Full CRUD with pagination, search, filters
   - RBAC enforcement (admin-only create/update/delete)

4. **API Gateway Security** ✅
   - Location: `packages/api-gateway/src/index.ts`
   - JWT verification for protected routes
   - User context headers forwarding
   - Rate limiting (10 req/15min for auth, 500 req/15min general)

5. **Health Endpoints** ✅
   - `/health` - Full health with dependency checks
   - `/health/live` - Liveness probe
   - `/health/ready` - Readiness probe
   - Returns: service name, version, uptime, dependency status

6. **Security Headers** ✅
   - Helmet with CSP/HSTS toggles via `HELMET_CSP_ENABLED`, `HELMET_HSTS_ENABLED`
   - Additional headers: Referrer-Policy, COEP, COOP, CORP, X-Download-Options

7. **CORS Configuration** ✅
   - Environment-based (`CORS_ORIGIN`, `CORS_CREDENTIALS`)
   - Aligned across Node.js and Python services
   - Validates origins against allowlist

8. **Port Standardization** ✅
   - API Gateway: 3000 (`API_GATEWAY_PORT`)
   - Main App: 3001 (`MAIN_APP_PORT`)
   - Aligned with `.env.example`

9. **Database Backups** ✅
   - Automated daily backups via `postgres-backup` service
   - Retention: 7 days, 4 weeks, 6 months
   - Volume: `postgres_backups`

10. **Refresh Token System** ✅
    - Secure storage with SHA-256 hashing
    - Token rotation on refresh
    - Revocation on logout
    - 30-day expiration

11. **Structured Logging** ✅
    - Location: `packages/shared/src/utils/logger.ts`
    - JSON format with service, level, timestamp, requestId
    - Log levels: DEBUG, INFO, WARN, ERROR
    - Request ID middleware included

12. **Environment Configuration** ✅
    - All configuration externalized to `.env`
    - Secure defaults
    - Documented in `.env.example`

### 🚧 Partially Implemented (1/20)

13. **Rate Limiting** 🟡
    - ✅ Auth endpoints: 10 req/15min
    - ✅ General API: 500 req/15min
    - ❌ Missing: `/api/plugins/install`, `/api/uploads` specific limits
    - ❌ Missing: Composite keys (userId + IP)
    - ❌ Missing: X-RateLimit-* headers

### ❌ Not Yet Implemented (7/20)

14. **Plugin Runtime & Registry** ❌
    - Need: `/api/plugins` CRUD routes
    - Need: Multipart upload handler
    - Need: Plugin manifest validation
    - Need: Sandbox execution environment
    - Need: Status transitions

15. **File Upload System** ❌
    - Need: Multer configuration
    - Need: `/api/uploads` route
    - Need: MIME validation (`ALLOWED_FILE_TYPES`)
    - Need: Filename sanitization

16. **Input Sanitization** ❌
    - Utilities exist in `@monorepo/shared`
    - Need: Apply to all routes
    - Need: Filename sanitization for uploads

17. **OpenAPI/Swagger** ❌
    - Need: `swagger-jsdoc` integration
    - Need: `/docs` endpoint (dev only)
    - Need: Document all routes

18. **Admin Dashboard Integration** ❌
    - Need: API client in `packages/admin/src/lib/api.ts`
    - Need: Replace mock data
    - Need: Route guards
    - Need: Loading states

19. **Login/Signup/Reset UI** ❌
    - Need: Auth pages in `packages/admin/src/pages/auth/`
    - Need: Material UI forms
    - Need: Token storage
    - Need: Protected route wrapper

20. **Plugin Quotas & Storage** ❌
    - Need: Quota enforcement class
    - Need: Plugin key-value storage API
    - Table exists: `plugin_kv_store`

## Quick Start Guide

### Prerequisites

```bash
# Install dependencies
npm install

# Build shared package
cd packages/shared && npm run build && cd ../..

# Create .env from example
cp .env.example .env
# Edit .env with your configuration
```

### Start Services

```bash
# Terminal 1: Start infrastructure
docker-compose up -d postgres redis postgres-backup

# Terminal 2: Start main-app (runs migrations automatically)
cd packages/main-app
npm run dev

# Terminal 3: Start api-gateway
cd packages/api-gateway
npm run dev

# Terminal 4 (Optional): Start frontend
cd packages/frontend
npm run dev

# Terminal 5 (Optional): Start admin
cd packages/admin
npm run dev
```

### Test Authentication

```bash
# 1. Register a new admin user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "username": "admin",
    "password": "SecurePass123!",
    "role": "admin"
  }'

# 2. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePass123!"
  }'

# Save the accessToken and refreshToken from response

# 3. Get current user
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# 4. List users
curl -X GET "http://localhost:3000/api/users?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# 5. Refresh token
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "YOUR_REFRESH_TOKEN"}'

# 6. Logout
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "YOUR_REFRESH_TOKEN"}'
```

### Test Health Endpoints

```bash
# API Gateway health
curl http://localhost:3000/health

# Main App health
curl http://localhost:3001/health

# Liveness probe
curl http://localhost:3001/health/live

# Readiness probe
curl http://localhost:3001/health/ready
```

### Database Access

```bash
# Connect to PostgreSQL
docker exec -it kevinalthaus-postgres psql -U postgres -d kevinalthaus

# Check migrations
kevinalthaus=# SELECT * FROM migrations ORDER BY executed_at;

# Check users
kevinalthaus=# SELECT id, email, username, role, created_at FROM users;

# Check refresh tokens
kevinalthaus=# SELECT user_id, expires_at, revoked_at FROM refresh_tokens WHERE revoked_at IS NULL;

# Exit
kevinalthaus=# \q
```

### Verify Backups

```bash
# Check backup service status
docker-compose ps postgres-backup

# List backups
docker exec kevinalthaus-postgres-backup ls -lh /backups

# Manual backup
docker exec kevinalthaus-postgres-backup /backup.sh

# Restore from backup
docker exec -i kevinalthaus-postgres psql -U postgres -d kevinalthaus < backup.sql
```

## Environment Variables Reference

Key variables from `.env.example`:

```bash
# Ports
API_GATEWAY_PORT=3000
MAIN_APP_PORT=3001
PYTHON_SERVICE_PORT=8000

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=kevinalthaus
POSTGRES_USER=postgres
POSTGRES_PASSWORD=changeme_secure_password

# Security (MUST change for production)
JWT_SECRET=changeme_generate_secure_random_string_minimum_32_chars
SESSION_SECRET=changeme_generate_secure_random_string_minimum_32_chars
ENCRYPTION_KEY=changeme_generate_secure_random_string_minimum_32_chars
PLUGIN_SIGNATURE_SECRET=changeme_generate_secure_random_string_minimum_32_chars

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:3002,http://localhost:3003
CORS_CREDENTIALS=true

# Security Headers
HELMET_CSP_ENABLED=true
HELMET_HSTS_ENABLED=true

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Features
ENABLE_PLUGIN_SYSTEM=true
ENABLE_THEME_SYSTEM=true
ENABLE_API_DOCS=true
```

## API Documentation

### Authentication Endpoints

#### POST /api/auth/register
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "password123",
  "role": "viewer"  // optional: admin, editor, viewer, guest
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "username",
    "role": "viewer"
  },
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token"
}
```

#### POST /api/auth/login
Authenticate a user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "username",
    "role": "viewer"
  },
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token"
}
```

#### POST /api/auth/refresh
Rotate refresh token.

**Request:**
```json
{
  "refreshToken": "current_refresh_token"
}
```

**Response:**
```json
{
  "message": "Token refreshed",
  "accessToken": "new_jwt_token",
  "refreshToken": "new_refresh_token"
}
```

#### POST /api/auth/logout
Revoke refresh token.

**Request:**
```json
{
  "refreshToken": "refresh_token"
}
```

**Response:**
```json
{
  "message": "Logout successful"
}
```

#### GET /api/auth/me
Get current user (requires JWT).

**Headers:**
```
Authorization: Bearer jwt_token
```

**Response:**
```json
{
  "user": {
    "userId": "uuid",
    "email": "user@example.com",
    "role": "viewer"
  }
}
```

### User Management Endpoints

All require JWT authentication. Admin-only for create/update/delete.

#### GET /api/users
List users with pagination.

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 10)
- `search` (optional): Search by email or username
- `role` (optional): Filter by role
- `active` (optional): Filter by active status

**Response:**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "username": "username",
      "role": "viewer",
      "created_at": "2024-01-01T00:00:00.000Z",
      "last_login": "2024-01-01T00:00:00.000Z",
      "is_active": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

#### POST /api/users
Create a new user (admin only).

**Request:**
```json
{
  "email": "newuser@example.com",
  "username": "newuser",
  "password": "password123",
  "role": "viewer"
}
```

#### PATCH /api/users/:id
Update a user (admin only).

**Request:**
```json
{
  "email": "updated@example.com",
  "username": "updated",
  "role": "editor",
  "is_active": true
}
```

#### DELETE /api/users/:id
Delete a user (admin only). Cannot delete yourself.

## Architecture Notes

### Database Schema

The system uses PostgreSQL with the following core tables:

- **users**: User accounts with RBAC
- **refresh_tokens**: Refresh token storage with rotation
- **plugin_registry**: Plugin metadata and status
- **system_settings**: System-wide configuration
- **audit_log**: Audit trail for all actions
- **plugin_kv_store**: Per-plugin key-value storage

### Security

- JWT tokens expire based on `JWT_EXPIRES_IN` (default: 7 days)
- Refresh tokens expire after 30 days
- Passwords hashed with bcrypt (12 rounds)
- Refresh tokens hashed with SHA-256 before storage
- CORS enforced with explicit origin allowlist
- Helmet security headers with configurable CSP/HSTS
- Rate limiting on sensitive endpoints

### Logging

Structured JSON logging with:
- Service name
- Log level (DEBUG, INFO, WARN, ERROR)
- Timestamp (ISO 8601)
- Request ID (UUID)
- Context metadata

Configure log level via `LOG_LEVEL` environment variable.

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Migration Issues

```bash
# Check migration status
docker exec -it kevinalthaus-postgres psql -U postgres -d kevinalthaus -c "SELECT * FROM migrations;"

# Reset database (WARNING: destroys all data)
docker-compose down -v
docker-compose up -d postgres
# Migrations will run automatically on next main-app start
```

### Authentication Issues

```bash
# Check JWT secret is set
echo $JWT_SECRET

# Verify user exists
docker exec -it kevinalthaus-postgres psql -U postgres -d kevinalthaus -c "SELECT email, role FROM users;"

# Check token expiration
# Decode JWT at https://jwt.io
```

## Next Steps

To complete the remaining features:

1. **File Upload System** - Required for plugin installation
2. **Plugin Runtime** - Core platform feature
3. **Input Sanitization** - Apply to all routes
4. **Admin Dashboard Integration** - UI functionality
5. **Login/Signup UI** - User-facing authentication
6. **OpenAPI Docs** - Developer experience
7. **Advanced Rate Limiting** - Enhanced security

See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for detailed implementation guidance.
