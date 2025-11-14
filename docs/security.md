# Security Guide

## Overview

The platform applies defense-in-depth across auth, CSRF, CORS, headers, and internal service trust.

## Highlights

- JWT auth with refresh rotation and RBAC
- CSRF protections on admin routes: token + Origin/Referer checks + allowed Content-Types
- Strict security headers (Helmet) with environment toggles
- CORS allowlist via environment variables, consistent across services
- **CORS hardening**: Wildcard origins (`*`) are rejected when credentials are enabled in production
- Internal service authentication via shared gateway token in production
- Docker network isolation: internal services are not exposed publicly
- **Structured logging**: All services use request IDs for tracing; errors never expose filesystem paths to clients
- **Upload security**: Quarantine-based validation with magic-byte sniffing; all errors sanitized before client response
- PostgreSQL TLS hardening with CA/hostname validation (`PGSSLMODE=verify-full`)

## PostgreSQL TLS Requirements

- Provision three files in `./secrets` before starting containers: `server.crt`, `server.key`, and `ca.crt`. The CA file must be the issuer of `server.crt`, as mounted into `main-app` at `/run/secrets/postgres_ca.crt`.
- Run `./scripts/generate-ssl-certs.sh` for local testing; it now creates a local CA, signs `server.crt` with SAN entries for `postgres` and `localhost`, and writes `ca.crt` next to the server assets. For production, copy the CA-provided files into the same locations.
- File permissions must allow the Docker runtime user (typically your host user ID) to read `./secrets/ca.crt` so the bind mount remains readable inside the `main-app` container. Recommended: `chmod 640 ca.crt` and `chmod 600 server.key`.
- Verify the certificate chain prior to deployment: `openssl verify -CAfile ./secrets/ca.crt ./secrets/server.crt` should return `OK`. When using public CA chains, place the full chain (root + intermediates) in `ca.crt`.
- Ensure the server certificate's CN or SAN entries include the hostname used by clients (`postgres` on the Docker network). Mismatched hostnames will cause `PGSSLMODE=verify-full` to abort connections during startup.
- If replacing certificates, update both the `postgres` service mounts (`./secrets/server.crt`, `./secrets/server.key`) and the client CA mount (`./secrets/ca.crt`) so that `packages/main-app/src/db/index.ts` can read the correct trust anchor.

## Admin CSRF Requirements

All admin POST/PUT/PATCH/DELETE requests require:
- Valid CSRF token (double-submit cookie)
- Valid Origin or Referer matching current host
- Allowed Content-Type (form-urlencoded, JSON, or multipart)
- Authenticated session

## CORS Configuration

### Production Hardening

In production (`NODE_ENV=production`), the API Gateway enforces strict CORS policies:

- **Wildcard origins with credentials are prohibited**: If `CORS_CREDENTIALS=true`, the system will reject wildcard CORS origins (`*`) and require an explicit allowlist
- This prevents credential leakage attacks where malicious sites could make authenticated requests
- Set `CORS_ORIGIN` to a comma-separated list of allowed origins (e.g., `https://app.example.com,https://admin.example.com`)

### Development Configuration

- Default allowed origins: `http://localhost:3000,http://localhost:3002,http://localhost:3003`
- Wildcard (`*`) is permitted in development but credentials are automatically disabled when wildcard is used
- Use `CORS_CREDENTIALS=true` with explicit origin list for testing authenticated cross-origin requests

## Structured Logging

All services use the shared logger (`createLogger()` from `@monorepo/shared`) for consistent, structured logging:

### Request Tracing

- **Request IDs**: Automatically generated and propagated across services for request correlation
- **Error metadata**: All error logs include `method`, `url`, `stack`, `requestId`, `statusCode` fields
- **API Gateway**: Error handler uses structured logging exclusively; `console.error()` is never used

### Configuration

- **Log levels**: Controlled via `LOG_LEVEL` environment variable (debug, info, warn, error)
- **Log format**: Set via `LOG_FORMAT` environment variable
  - `json`: Structured JSON format for log aggregation systems
  - `text`: Human-readable format for development (default)
- **Log sampling**: In production, query logs are sampled (every 10th query) to reduce volume

### Security

- **No path leakage**: Filesystem paths and internal implementation details are logged server-side only
- **Client responses**: Error responses to clients contain only sanitized, generic messages
- **Stack traces**: Available in logs for debugging but never exposed in production API responses

## Upload Security

### Quarantine-Based Validation

All file uploads go through a multi-stage validation process:

1. **Pre-upload filtering**: Extension and MIME type checked before disk write
2. **Quarantine storage**: Files written to isolated quarantine directory
3. **Magic-byte validation**: Content sniffing with `file-type` library to detect actual file type
4. **Extension matching**: Detected MIME type must match file extension
5. **Atomic promotion**: Files moved to final upload directory only after all checks pass

### Error Hygiene

- **No path leakage**: Filesystem paths are never exposed in client-facing error responses
- **Server-side logging**: Full error details with paths are logged server-side only
- **Automatic cleanup**: Failed uploads are removed from quarantine immediately
- **Generic error messages**: Clients receive sanitized messages like "File validation failed"

### Configuration

- `ALLOWED_FILE_TYPES`: Comma-separated list of allowed MIME types (default: `image/jpeg,image/png,image/gif,image/webp,application/pdf`)
- `UPLOAD_MAX_SIZE`: Maximum file size in bytes (default: 10MB)
- `UPLOAD_DIRECTORY`: Final storage directory for validated uploads
- `UPLOAD_QUARANTINE_DIR`: Temporary storage during validation

## Recommendations

- Use Redis or DB-backed sessions in multi-instance deployments
- Enforce HTTPS in production; `SameSite=None` requires `Secure` cookies
- Rotate secrets regularly and store securely

See `docs/maintainers/pending-fixes.md` for open security/code-quality items.
