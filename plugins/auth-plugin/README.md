# Authentication Plugin

A comprehensive JWT-based authentication plugin for the kevinalthaus.com platform, providing user registration, login, token management, and role-based access control.

## Features

- **User Registration**: Secure user registration with password hashing
- **User Login**: JWT-based authentication with access and refresh tokens
- **Token Refresh**: Automatic access token refresh mechanism
- **Secure Logout**: Token revocation and cleanup
- **Role-Based Access Control (RBAC)**: Support for multiple user roles (admin, editor, viewer)
- **User Profile**: Retrieve authenticated user information

## API Endpoints

### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "securePassword123",
  "role": "viewer"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "userId": "uuid"
}
```

### POST /api/auth/login
Authenticate user and receive JWT tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "accessToken": "jwt_access_token",
  "refreshToken": "jwt_refresh_token",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "username",
    "role": "viewer"
  }
}
```

### POST /api/auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

**Response:**
```json
{
  "accessToken": "new_jwt_access_token"
}
```

### POST /api/auth/logout
Logout user and revoke refresh token.

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Request Body:**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

### GET /api/auth/me
Get current authenticated user information.

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "username",
  "role": "viewer",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'viewer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Refresh Tokens Table
```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Roles and Permissions

- **admin**: Full system access, can manage all users and content
- **editor**: Can create and edit content
- **viewer**: Read-only access to content

## Security Features

- Passwords hashed using bcrypt
- JWT tokens with configurable expiration
- Refresh token rotation
- Token revocation on logout
- Role-based access control middleware
- Secure token storage in database

## Installation

The plugin follows the standard plugin lifecycle:

1. **Install**: Creates database tables and default admin user
2. **Activate**: Registers authentication routes and middleware
3. **Deactivate**: Unregisters routes and stops background services
4. **Uninstall**: Optionally removes database tables and user data

## Configuration

Required environment variables:

```env
JWT_SECRET=your_secure_random_string_minimum_32_chars
JWT_EXPIRES_IN=7d
```

## Development

### Build
```bash
npm run build
```

### Dependencies
- `@monorepo/shared`: Shared types and utilities
- `express`: Web framework
- `jsonwebtoken`: JWT token generation and verification
- `bcrypt`: Password hashing
- `pg`: PostgreSQL database client

## Future Enhancements

- Email verification
- Password reset functionality
- Two-factor authentication (2FA)
- OAuth integration (Google, GitHub, etc.)
- Account lockout after failed attempts
- Session management
- Audit logging

## License

MIT
