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
- POST `/api/auth/forgot-password`
- POST `/api/auth/reset-password`
- POST `/api/auth/change-password`
- GET  `/api/users/me`

### Example: Login

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "user@example.com", "password": "secure_password" }
```

### POST /api/auth/forgot-password

Request a password reset token via email.

**Authentication:** Not required (public endpoint)

**Rate Limiting:** Recommend 3 requests per 15 minutes per IP address

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:** 200 OK (always returns success to prevent email enumeration)
```json
{
  "message": "If an account exists with this email, a password reset link has been sent"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid email format or missing email
- `500 Internal Server Error` - Server error

**Security Notes:**
- Returns success regardless of email existence to prevent enumeration attacks
- Token expires in 30 minutes
- Tokens are single-use only
- Email contains reset link with format: `{FRONTEND_URL}/reset-password?token={token}`

### POST /api/auth/reset-password

Reset password using a valid reset token from email.

**Authentication:** Not required (uses token from email)

**Request Body:**
```json
{
  "token": "64-character-hex-string-from-email",
  "newPassword": "NewSecurePass123!"
}
```

**Response:** 200 OK
```json
{
  "message": "Password has been reset successfully. Please login with your new password"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid/expired token, weak password, or password reused from history
- `500 Internal Server Error` - Server error

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one special character (!@#$%^&*(),.?":{}|<>)
- Cannot match any of the last 3 passwords used

**Security Notes:**
- Token is single-use (marked as used after successful reset)
- All refresh tokens are revoked after password reset (logs out all devices)
- Password cannot match last 3 passwords
- Token must not be expired (30-minute validity)

### POST /api/auth/change-password

Change password for authenticated user.

**Authentication:** Required (Bearer token or cookie)

**Request Body:**
```json
{
  "currentPassword": "OldSecurePass123!",
  "newPassword": "NewSecurePass456!"
}
```

**Response:** 200 OK
```json
{
  "message": "Password changed successfully"
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid current password or not authenticated
- `400 Bad Request` - Weak new password, password reused from history, or new password same as current
- `500 Internal Server Error` - Server error

**Password Requirements:**
- Same as reset-password endpoint (see above)
- New password must be different from current password
- Cannot match any of the last 3 passwords used

**Security Notes:**
- Requires current password verification
- Password cannot match last 3 passwords
- User remains logged in on current device (refresh tokens not revoked)

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

