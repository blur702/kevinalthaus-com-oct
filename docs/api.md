# API Reference

## Authentication

Two modes supported:
- Cookie-based (web): tokens are set as HTTP-only cookies on login; no Authorization header required for web clients.
- Header-based (mobile/server): `Authorization: Bearer <token>` header required.

Cookie behavior is controlled by `COOKIE_SAMESITE` and cookies are secure in production.

### Endpoints

- POST `/api/auth/register`
- POST `/api/auth/login`
- POST `/api/auth/refresh`
- POST `/api/auth/logout`
- GET  `/api/users/me`

### Example: Login

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "user@example.com", "password": "secure_password" }
```

## Users

- GET `/api/users` — pagination and filters supported
- GET `/api/users/:id`
- POST `/api/users` — admin only
- PATCH `/api/users/:id` — admin only
- DELETE `/api/users/:id` — admin only

## Health

- GET `/health` — service status & version
- GET `/health/live` — liveness
- GET `/health/ready` — readiness

## Plugins

Note: Admin UI handles plugin management. REST endpoints for plugin CRUD are planned but not implemented yet.

