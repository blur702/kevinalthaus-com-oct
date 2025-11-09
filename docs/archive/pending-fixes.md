# Pending Fixes (Maintainers)

Consolidated outstanding security and code-quality tasks. Verify line references against current code before changes.

## Admin API CSRF & Error Handling

Add CSRF token manager and interceptors; improve error handling/validation in `packages/admin/src/lib/api.ts`.

```ts
// CSRF token manager and request/response interceptors (abbrev.)
class CSRFTokenManager { /* ... */ }
const csrfManager = new CSRFTokenManager();
// Attach X-CSRF-Token to mutating requests; handle 403 CSRF refresh
```

## API Gateway Improvements

- Use secure proxy for `/api/plugins` to match other routes
- Disallow wildcard origins in production; rely on allowlist
- Replace `console.error` in error handler with structured logger

## Caching/Performance

- Extend cache key with content negotiation headers in `api-gateway` performance middleware
- Decide if array order matters in `main-app` canonicalizeQuery; sort if not

## Upload Handling (main-app)

- Track and delete moved files on error to avoid orphaned files
- Validate extension fallback and tighten MIME/type checks

## Scripts

`scripts/monitor-postgres.sh`
- Send errors to stderr
- Compute dynamic status (healthy/warning/critical)
- Use `docker inspect` for reliable container lookup
- Deduplicate percentage calculations
- Validate presence of `bc` and computed values

`scripts/restore-postgres.sh`
- Validate DB name before DROP/CREATE
- Use psql identifier substitution `:"variable"`

`scripts/setup-cron.sh`
- Use safe, fixed error log path and ensure directory exists

