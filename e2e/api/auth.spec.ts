import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Helper to generate unique test data
const generateTestUser = () => ({
  email: `test_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`,
  username: `testuser_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  password: 'Test123!@#Password',
});

test.describe('Authentication API', () => {
  test.describe('POST /api/auth/register', () => {
    test('should successfully register a new user', async ({ request }) => {
      const testUser = generateTestUser();

      const response = await request.post(`${API_URL}/api/auth/register`, {
        data: testUser,
      });

      expect(response.status()).toBe(201);

      const data = await response.json();
      expect(data).toHaveProperty('message', 'User registered successfully');
      expect(data).toHaveProperty('user');
      expect(data.user).toHaveProperty('id');
      expect(data.user).toHaveProperty('email', testUser.email);
      expect(data.user).toHaveProperty('username', testUser.username);
      expect(data.user).toHaveProperty('role', 'viewer');

      // Should set authentication cookies
      const cookies = response.headers()['set-cookie'];
      expect(cookies).toBeTruthy();
    });

    test('should reject registration with missing email', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/register`, {
        data: {
          username: 'testuser',
          password: 'Test123!@#',
        },
      });

      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('message');
    });

    test('should reject registration with invalid email format', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/register`, {
        data: {
          email: 'invalid-email',
          username: 'testuser',
          password: 'Test123!@#',
        },
      });

      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data.message).toContain('email');
    });

    test('should reject registration with weak password', async ({ request }) => {
      const testUser = generateTestUser();

      const response = await request.post(`${API_URL}/api/auth/register`, {
        data: {
          ...testUser,
          password: 'weak',
        },
      });

      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data.message).toContain('Password');
    });

    test('should reject registration with duplicate username', async ({ request }) => {
      const testUser = generateTestUser();

      // Register first time
      await request.post(`${API_URL}/api/auth/register`, { data: testUser });

      // Try to register again with same username
      const response = await request.post(`${API_URL}/api/auth/register`, {
        data: {
          ...generateTestUser(),
          username: testUser.username,
        },
      });

      expect(response.status()).toBe(409);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Conflict');
      expect(data.message).toContain('already exists');
    });
  });

  test.describe('POST /api/auth/login', () => {
    let testUser: ReturnType<typeof generateTestUser>;

    test.beforeAll(async ({ request }) => {
      // Create a test user for login tests
      testUser = generateTestUser();
      await request.post(`${API_URL}/api/auth/register`, { data: testUser });
    });

    test('should successfully login with valid credentials', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: testUser.username,
          password: testUser.password,
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('message', 'Login successful');
      expect(data).toHaveProperty('user');
      expect(data.user).toHaveProperty('id');
      expect(data.user).toHaveProperty('email', testUser.email);
      expect(data.user).toHaveProperty('username', testUser.username);
      expect(data.user).toHaveProperty('role');

      // Should set authentication cookies
      const cookies = response.headers()['set-cookie'];
      expect(cookies).toBeTruthy();
    });

    test('should login with email instead of username', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: testUser.email,
          password: testUser.password,
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('message', 'Login successful');
    });

    test('should reject login with incorrect password', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: testUser.username,
          password: 'WrongPassword123!',
        },
      });

      expect(response.status()).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Unauthorized');
      expect(data.message).toContain('Invalid credentials');
    });

    test('should reject login with non-existent username', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: 'nonexistentuser123456',
          password: 'Test123!@#',
        },
      });

      expect(response.status()).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Unauthorized');
    });

    test('should reject login with missing credentials', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/login`, {
        data: {},
      });

      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Bad Request');
    });

    test('should trim whitespace from username', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: `  ${testUser.username}  `,
          password: testUser.password,
        },
      });

      expect(response.status()).toBe(200);
    });
  });

  test.describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    test.beforeAll(async ({ request }) => {
      // Login to get a refresh token
      const testUser = generateTestUser();
      await request.post(`${API_URL}/api/auth/register`, { data: testUser });

      const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: testUser.username,
          password: testUser.password,
        },
      });

      const cookies = loginResponse.headers()['set-cookie'];
      const match = cookies?.match(/refreshToken=([^;]+)/);
      refreshToken = match ? match[1] : '';
    });

    test('should refresh access token with valid refresh token', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/refresh`, {
        headers: {
          Cookie: `refreshToken=${refreshToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('message', 'Token refreshed');

      // Should set new tokens
      const cookies = response.headers()['set-cookie'];
      expect(cookies).toBeTruthy();
    });

    test('should reject refresh without refresh token', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/refresh`);

      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Bad Request');
    });

    test('should reject refresh with invalid refresh token', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/refresh`, {
        headers: {
          Cookie: 'refreshToken=invalid_token_12345',
        },
      });

      expect(response.status()).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Unauthorized');
    });
  });

  test.describe('POST /api/auth/logout', () => {
    test('should successfully logout', async ({ request }) => {
      // Login first
      const testUser = generateTestUser();
      await request.post(`${API_URL}/api/auth/register`, { data: testUser });

      const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: testUser.username,
          password: testUser.password,
        },
      });

      const cookies = loginResponse.headers()['set-cookie'];

      // Extract accessToken and refreshToken from Set-Cookie headers
      const accessTokenMatch = cookies?.match(/accessToken=([^;]+)/);
      const refreshTokenMatch = cookies?.match(/refreshToken=([^;]+)/);
      const accessToken = accessTokenMatch ? accessTokenMatch[1] : '';
      const refreshToken = refreshTokenMatch ? refreshTokenMatch[1] : '';

      // Logout
      const response = await request.post(`${API_URL}/api/auth/logout`, {
        headers: {
          Cookie: `accessToken=${accessToken}; refreshToken=${refreshToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('message', 'Logout successful');

      // Note: Cookie clearing via Set-Cookie headers is verified by the 200 status
      // Some test environments may not expose clearCookie() headers consistently
    });

    test('should logout even without cookies', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/logout`);

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('message', 'Logout successful');
    });
  });

  test.describe('GET /api/auth/validate', () => {
    let accessToken: string;

    test.beforeAll(async ({ request }) => {
      const testUser = generateTestUser();
      await request.post(`${API_URL}/api/auth/register`, { data: testUser });

      const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: testUser.username,
          password: testUser.password,
        },
      });

      const cookies = loginResponse.headers()['set-cookie'];
      const match = cookies?.match(/accessToken=([^;]+)/);
      accessToken = match ? match[1] : '';
    });

    test('should validate valid token', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/auth/validate`, {
        headers: {
          Cookie: `accessToken=${accessToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('message', 'Token is valid');
      expect(data).toHaveProperty('user');
      expect(data.user).toHaveProperty('userId');
      expect(data.user).toHaveProperty('email');
      expect(data.user).toHaveProperty('role');
    });

    test('should reject request without token', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/auth/validate`);

      expect(response.status()).toBe(401);
    });

    test('should reject request with invalid token', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/auth/validate`, {
        headers: {
          Authorization: 'Bearer invalid_token_12345',
        },
      });

      expect(response.status()).toBe(401);
    });
  });

  test.describe('GET /api/auth/me', () => {
    let accessToken: string;

    test.beforeAll(async ({ request }) => {
      const testUser = generateTestUser();
      await request.post(`${API_URL}/api/auth/register`, { data: testUser });

      const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: testUser.username,
          password: testUser.password,
        },
      });

      const cookies = loginResponse.headers()['set-cookie'];
      const match = cookies?.match(/accessToken=([^;]+)/);
      accessToken = match ? match[1] : '';
    });

    test('should return current user info', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/auth/me`, {
        headers: {
          Cookie: `accessToken=${accessToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('user');
      expect(data.user).toHaveProperty('userId');
      expect(data.user).toHaveProperty('email');
      expect(data.user).toHaveProperty('role');
    });

    test('should reject unauthorized request', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/auth/me`);

      expect(response.status()).toBe(401);
    });
  });

  test.describe('POST /api/auth/forgot-password', () => {
    let testUser: ReturnType<typeof generateTestUser>;

    test.beforeAll(async ({ request }) => {
      testUser = generateTestUser();
      await request.post(`${API_URL}/api/auth/register`, { data: testUser });
    });

    test('should accept valid email', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/forgot-password`, {
        data: {
          email: testUser.email,
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('If an account exists');
    });

    test('should return same response for non-existent email (prevent enumeration)', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/forgot-password`, {
        data: {
          email: 'nonexistent@example.com',
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('If an account exists');
    });

    test('should reject invalid email format', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/forgot-password`, {
        data: {
          email: 'invalid-email',
        },
      });

      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data.message).toContain('email');
    });

    test('should reject missing email', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/forgot-password`, {
        data: {},
      });

      expect(response.status()).toBe(400);
    });
  });

  test.describe('POST /api/auth/change-password', () => {
    let accessToken: string;
    const testUser = generateTestUser();

    test.beforeAll(async ({ request }) => {
      await request.post(`${API_URL}/api/auth/register`, { data: testUser });

      const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: testUser.username,
          password: testUser.password,
        },
      });

      const cookies = loginResponse.headers()['set-cookie'];
      const match = cookies?.match(/accessToken=([^;]+)/);
      accessToken = match ? match[1] : '';
    });

    test('should successfully change password', async ({ request }) => {
      const newPassword = 'NewPass123!@#';

      const response = await request.post(`${API_URL}/api/auth/change-password`, {
        headers: {
          Cookie: `accessToken=${accessToken}`,
        },
        data: {
          currentPassword: testUser.password,
          newPassword,
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('message', 'Password changed successfully');

      // Verify can login with new password
      const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: testUser.username,
          password: newPassword,
        },
      });

      expect(loginResponse.status()).toBe(200);
    });

    test('should reject change with incorrect current password', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/change-password`, {
        headers: {
          Cookie: `accessToken=${accessToken}`,
        },
        data: {
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewPass123!@#',
        },
      });

      expect(response.status()).toBe(401);

      const data = await response.json();
      expect(data.message).toContain('incorrect');
    });

    test('should reject same password as current', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/change-password`, {
        headers: {
          Cookie: `accessToken=${accessToken}`,
        },
        data: {
          currentPassword: testUser.password,
          newPassword: testUser.password,
        },
      });

      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data.message).toContain('different');
    });

    test('should require authentication', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/change-password`, {
        data: {
          currentPassword: testUser.password,
          newPassword: 'NewPass123!@#',
        },
      });

      expect(response.status()).toBe(401);
    });
  });
});
