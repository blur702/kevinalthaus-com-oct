/**
 * Comprehensive Authentication API Tests
 * Tests all authentication endpoints including registration, login, logout,
 * password reset, password change, token refresh, and token validation
 */

import { test, expect } from './fixtures/console-monitor-fixture';

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Test data
const testUser = {
  email: `test-${Date.now()}@example.com`,
  username: `testuser${Date.now()}`,
  password: 'Test123!@#'
};

const adminUser = {
  username: 'admin',
  password: 'Admin123!@#'
};

test.describe('Authentication API - /api/auth', () => {

  test.describe('POST /api/auth/register', () => {

    test('should register a new user with valid data', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/register`, {
        data: {
          email: testUser.email,
          username: testUser.username,
          password: testUser.password
        }
      });

      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.message).toBe('User registered successfully');
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe(testUser.email);
      expect(body.user.username).toBe(testUser.username);
      expect(body.user.role).toBe('viewer'); // Default role

      // Check cookies are set
      const cookies = response.headers()['set-cookie'];
      expect(cookies).toContain('accessToken');
      expect(cookies).toContain('refreshToken');
    });

    test('should reject registration with missing email', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/register`, {
        data: {
          username: 'testuser',
          password: 'Test123!@#'
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Bad Request');
    });

    test('should reject registration with missing username', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/register`, {
        data: {
          email: 'test@example.com',
          password: 'Test123!@#'
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Bad Request');
    });

    test('should reject registration with missing password', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/register`, {
        data: {
          email: 'test@example.com',
          username: 'testuser'
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Bad Request');
    });

    test('should reject registration with invalid email format', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/register`, {
        data: {
          email: 'invalid-email',
          username: 'testuser',
          password: 'Test123!@#'
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.message).toContain('Invalid email format');
    });

    test('should reject registration with weak password', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/register`, {
        data: {
          email: 'test@example.com',
          username: 'testuser',
          password: 'weak'
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.message).toContain('Password must be at least 8 characters');
    });

    test('should reject registration with duplicate username', async ({ request }) => {
      const uniqueUser = {
        email: `unique-${Date.now()}@example.com`,
        username: `unique${Date.now()}`,
        password: 'Test123!@#'
      };

      // Register first time
      await request.post(`${API_URL}/api/auth/register`, { data: uniqueUser });

      // Try to register again with same username
      const response = await request.post(`${API_URL}/api/auth/register`, {
        data: {
          email: `different-${Date.now()}@example.com`,
          username: uniqueUser.username,
          password: 'Test123!@#'
        }
      });

      expect(response.status()).toBe(409);
      const body = await response.json();
      expect(body.error).toBe('Conflict');
    });
  });

  test.describe('POST /api/auth/login', () => {

    test.beforeAll(async ({ request }) => {
      // Register a test user for login tests
      await request.post(`${API_URL}/api/auth/register`, {
        data: {
          email: testUser.email,
          username: testUser.username,
          password: testUser.password
        }
      });
    });

    test('should login with valid credentials', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: testUser.username,
          password: testUser.password
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.message).toBe('Login successful');
      expect(body.user).toBeDefined();
      expect(body.user.username).toBe(testUser.username);

      // Check cookies are set
      const cookies = response.headers()['set-cookie'];
      expect(cookies).toContain('accessToken');
      expect(cookies).toContain('refreshToken');
    });

    test('should login with email instead of username', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: testUser.email, // Using email as username
          password: testUser.password
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.message).toBe('Login successful');
    });

    test('should reject login with invalid credentials', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: testUser.username,
          password: 'WrongPassword123!@#'
        }
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('Invalid credentials');
    });

    test('should reject login with non-existent user', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: 'nonexistentuser',
          password: 'Test123!@#'
        }
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    test('should reject login with missing username', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          password: 'Test123!@#'
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Bad Request');
    });

    test('should reject login with missing password', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: testUser.username
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Bad Request');
    });
  });

  test.describe('POST /api/auth/refresh', () => {

    let refreshToken: string;

    test.beforeAll(async ({ request }) => {
      // Login to get refresh token
      const response = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: testUser.username,
          password: testUser.password
        }
      });

      const cookies = response.headers()['set-cookie'];
      const match = cookies?.match(/refreshToken=([^;]+)/);
      refreshToken = match ? match[1] : '';
    });

    test('should refresh access token with valid refresh token', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/refresh`, {
        headers: {
          Cookie: `refreshToken=${refreshToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.message).toBe('Token refreshed');

      // Check new cookies are set
      const cookies = response.headers()['set-cookie'];
      expect(cookies).toContain('accessToken');
      expect(cookies).toContain('refreshToken');
    });

    test('should reject refresh with invalid refresh token', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/refresh`, {
        headers: {
          Cookie: 'refreshToken=invalid-token'
        }
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    test('should reject refresh with missing refresh token', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/refresh`);

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Bad Request');
    });
  });

  test.describe('POST /api/auth/logout', () => {

    test('should logout successfully', async ({ request }) => {
      // Login first
      const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: testUser.username,
          password: testUser.password
        }
      });

      const cookies = loginResponse.headers()['set-cookie'];

      // Logout
      const response = await request.post(`${API_URL}/api/auth/logout`, {
        headers: {
          Cookie: cookies || ''
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.message).toBe('Logout successful');

      // Check cookies are cleared
      const logoutCookies = response.headers()['set-cookie'];
      expect(logoutCookies).toContain('accessToken=;');
      expect(logoutCookies).toContain('refreshToken=;');
    });

    test('should logout even without valid token', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/logout`);

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.message).toBe('Logout successful');
    });
  });

  test.describe('POST /api/auth/forgot-password', () => {

    test('should send password reset email for valid email', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/forgot-password`, {
        data: {
          email: testUser.email
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.message).toContain('password reset link has been sent');
    });

    test('should return success for non-existent email (no enumeration)', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/forgot-password`, {
        data: {
          email: 'nonexistent@example.com'
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.message).toContain('password reset link has been sent');
    });

    test('should reject forgot password with invalid email format', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/forgot-password`, {
        data: {
          email: 'invalid-email'
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.message).toContain('Invalid email format');
    });

    test('should reject forgot password with missing email', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/forgot-password`, {
        data: {}
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Bad Request');
    });
  });

  test.describe('POST /api/auth/change-password', () => {

    let accessToken: string;

    test.beforeAll(async ({ request }) => {
      // Login to get access token
      const response = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: testUser.username,
          password: testUser.password
        }
      });

      const cookies = response.headers()['set-cookie'];
      const match = cookies?.match(/accessToken=([^;]+)/);
      accessToken = match ? match[1] : '';
    });

    test('should change password with valid current password', async ({ request }) => {
      const newPassword = 'NewTest123!@#';

      const response = await request.post(`${API_URL}/api/auth/change-password`, {
        headers: {
          Cookie: `accessToken=${accessToken}`
        },
        data: {
          currentPassword: testUser.password,
          newPassword: newPassword
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.message).toBe('Password changed successfully');

      // Change password back
      await request.post(`${API_URL}/api/auth/change-password`, {
        headers: {
          Cookie: `accessToken=${accessToken}`
        },
        data: {
          currentPassword: newPassword,
          newPassword: testUser.password
        }
      });
    });

    test('should reject password change with incorrect current password', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/change-password`, {
        headers: {
          Cookie: `accessToken=${accessToken}`
        },
        data: {
          currentPassword: 'WrongPassword123!@#',
          newPassword: 'NewTest123!@#'
        }
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.message).toBe('Current password is incorrect');
    });

    test('should reject password change when new password same as current', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/change-password`, {
        headers: {
          Cookie: `accessToken=${accessToken}`
        },
        data: {
          currentPassword: testUser.password,
          newPassword: testUser.password
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.message).toContain('New password must be different');
    });

    test('should reject password change with weak new password', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/change-password`, {
        headers: {
          Cookie: `accessToken=${accessToken}`
        },
        data: {
          currentPassword: testUser.password,
          newPassword: 'weak'
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.message).toContain('Password must be at least 8 characters');
    });

    test('should reject password change without authentication', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/change-password`, {
        data: {
          currentPassword: testUser.password,
          newPassword: 'NewTest123!@#'
        }
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });
  });

  test.describe('GET /api/auth/validate', () => {

    let accessToken: string;

    test.beforeAll(async ({ request }) => {
      // Login to get access token
      const response = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: testUser.username,
          password: testUser.password
        }
      });

      const cookies = response.headers()['set-cookie'];
      const match = cookies?.match(/accessToken=([^;]+)/);
      accessToken = match ? match[1] : '';
    });

    test('should validate valid token', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/auth/validate`, {
        headers: {
          Cookie: `accessToken=${accessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.message).toBe('Token is valid');
      expect(body.user).toBeDefined();
    });

    test('should reject validation without token', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/auth/validate`);

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    test('should reject validation with invalid token', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/auth/validate`, {
        headers: {
          Cookie: 'accessToken=invalid-token'
        }
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });
  });

  test.describe('GET /api/auth/me', () => {

    let accessToken: string;

    test.beforeAll(async ({ request }) => {
      // Login to get access token
      const response = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: testUser.username,
          password: testUser.password
        }
      });

      const cookies = response.headers()['set-cookie'];
      const match = cookies?.match(/accessToken=([^;]+)/);
      accessToken = match ? match[1] : '';
    });

    test('should return current user info', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/auth/me`, {
        headers: {
          Cookie: `accessToken=${accessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe(testUser.email);
    });

    test('should reject me request without token', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/auth/me`);

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });
  });
});
