import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Helper to generate unique test data
const generateTestUser = () => ({
  email: `test_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`,
  username: `testuser_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  password: 'Test123!@#Password',
});

// Helper to get admin token
async function getAdminToken(request: any): Promise<string> {
  const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
    data: {
      username: process.env.ADMIN_USERNAME || 'kevin',
      password: process.env.ADMIN_PASSWORD || 'kevin',
    },
  });

  const cookies = loginResponse.headers()['set-cookie'];
  const match = cookies?.match(/accessToken=([^;]+)/);
  return match ? match[1] : '';
}

test.describe('User Management API', () => {
  let adminToken: string;
  let testUserId: string;

  test.beforeAll(async ({ request }) => {
    adminToken = await getAdminToken(request);

    // Create a test user for read/update/delete tests
    const testUser = generateTestUser();
    const response = await request.post(`${API_URL}/api/users`, {
      headers: {
        Cookie: `accessToken=${adminToken}`,
      },
      data: testUser,
    });

    const data = await response.json();
    testUserId = data.id;
  });

  test.describe('GET /api/users', () => {
    test('should list users with default pagination', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/users`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('users');
      expect(data).toHaveProperty('pagination');
      expect(Array.isArray(data.users)).toBe(true);

      // Validate pagination object
      expect(data.pagination).toHaveProperty('page', 1);
      expect(data.pagination).toHaveProperty('limit', 10);
      expect(data.pagination).toHaveProperty('total');
      expect(data.pagination).toHaveProperty('totalPages');
    });

    test('should support custom pagination parameters', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/users?page=1&limit=5`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(5);
      expect(data.users.length).toBeLessThanOrEqual(5);
    });

    test('should search users by email', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/users?email=test`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      // All returned users should have email containing 'test'
      data.users.forEach((user: any) => {
        expect(user.email.toLowerCase()).toContain('test');
      });
    });

    test('should filter users by role', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/users?role=admin`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      // All returned users should have admin role
      data.users.forEach((user: any) => {
        expect(user.role).toBe('admin');
      });
    });

    test('should filter users by active status', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/users?active=true`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      // All returned users should be active
      data.users.forEach((user: any) => {
        expect(user.is_active).toBe(true);
      });
    });

    test('should reject invalid role filter', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/users?role=invalid`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
      });

      expect(response.status()).toBe(400);
    });

    test('should require authentication', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/users`);

      expect(response.status()).toBe(401);
    });

    test('should enforce maximum limit of 100', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/users?limit=200`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.pagination.limit).toBe(100); // Should be capped at 100
    });
  });

  test.describe('GET /api/users/:id', () => {
    test('should get user by ID', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/users/${testUserId}`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('user');
      expect(data.user).toHaveProperty('id', testUserId);
      expect(data.user).toHaveProperty('email');
      expect(data.user).toHaveProperty('username');
      expect(data.user).toHaveProperty('role');
      expect(data.user).toHaveProperty('created_at');
      expect(data.user).toHaveProperty('is_active');
    });

    test('should return 404 for non-existent user', async ({ request }) => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request.get(`${API_URL}/api/users/${fakeId}`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
      });

      expect(response.status()).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Not Found');
    });

    test('should require authentication', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/users/${testUserId}`);

      expect(response.status()).toBe(401);
    });
  });

  test.describe('POST /api/users', () => {
    test('should create new user as admin', async ({ request }) => {
      const testUser = generateTestUser();

      const response = await request.post(`${API_URL}/api/users`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
        data: testUser,
      });

      expect(response.status()).toBe(201);

      const data = await response.json();
      expect(data).toHaveProperty('message', 'User created successfully');
      expect(data).toHaveProperty('user');
      expect(data.user).toHaveProperty('id');
      expect(data.user).toHaveProperty('email', testUser.email);
      expect(data.user).toHaveProperty('username', testUser.username);
      expect(data.user).toHaveProperty('role');
    });

    test('should create user with custom role', async ({ request }) => {
      const testUser = {
        ...generateTestUser(),
        role: 'editor',
      };

      const response = await request.post(`${API_URL}/api/users`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
        data: testUser,
      });

      expect(response.status()).toBe(201);

      const data = await response.json();
      expect(data.user.role).toBe('editor');
    });

    test('should reject creation with missing required fields', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/users`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
        data: {
          email: 'test@example.com',
        },
      });

      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Bad Request');
    });

    test('should reject invalid email format', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/users`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
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

    test('should reject invalid username format', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/users`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
        data: {
          email: 'test@example.com',
          username: 'ab', // Too short
          password: 'Test123!@#',
        },
      });

      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data.message).toContain('Username');
    });

    test('should reject duplicate email', async ({ request }) => {
      const testUser = generateTestUser();

      // Create first user
      await request.post(`${API_URL}/api/users`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
        data: testUser,
      });

      // Try to create second user with same email
      const response = await request.post(`${API_URL}/api/users`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
        data: {
          ...generateTestUser(),
          email: testUser.email,
        },
      });

      expect(response.status()).toBe(409);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Conflict');
      expect(data.message).toContain('Email already exists');
    });

    test('should require admin role', async ({ request }) => {
      // Create a non-admin user and get their token
      const viewerUser = generateTestUser();
      await request.post(`${API_URL}/api/auth/register`, { data: viewerUser });

      const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: viewerUser.username,
          password: viewerUser.password,
        },
      });

      const cookies = loginResponse.headers()['set-cookie'];
      const match = cookies?.match(/accessToken=([^;]+)/);
      const viewerToken = match ? match[1] : '';

      // Try to create user as viewer
      const response = await request.post(`${API_URL}/api/users`, {
        headers: {
          Cookie: `accessToken=${viewerToken}`,
        },
        data: generateTestUser(),
      });

      expect(response.status()).toBe(403);
    });
  });

  test.describe('PATCH /api/users/:id', () => {
    test('should update user email', async ({ request }) => {
      const newEmail = `updated_${Date.now()}@example.com`;

      const response = await request.patch(`${API_URL}/api/users/${testUserId}`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
        data: {
          email: newEmail,
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('message', 'User updated successfully');
      expect(data.user.email).toBe(newEmail);
    });

    test('should update user role', async ({ request }) => {
      const response = await request.patch(`${API_URL}/api/users/${testUserId}`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
        data: {
          role: 'editor',
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.user.role).toBe('editor');
    });

    test('should update user active status', async ({ request }) => {
      const response = await request.patch(`${API_URL}/api/users/${testUserId}`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
        data: {
          is_active: false,
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.user.is_active).toBe(false);
    });

    test('should return 404 for non-existent user', async ({ request }) => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request.patch(`${API_URL}/api/users/${fakeId}`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
        data: {
          email: 'new@example.com',
        },
      });

      expect(response.status()).toBe(404);
    });

    test('should reject empty update', async ({ request }) => {
      const response = await request.patch(`${API_URL}/api/users/${testUserId}`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
        data: {},
      });

      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data.message).toContain('No fields to update');
    });

    test('should require admin role', async ({ request }) => {
      const viewerUser = generateTestUser();
      await request.post(`${API_URL}/api/auth/register`, { data: viewerUser });

      const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: viewerUser.username,
          password: viewerUser.password,
        },
      });

      const cookies = loginResponse.headers()['set-cookie'];
      const match = cookies?.match(/accessToken=([^;]+)/);
      const viewerToken = match ? match[1] : '';

      const response = await request.patch(`${API_URL}/api/users/${testUserId}`, {
        headers: {
          Cookie: `accessToken=${viewerToken}`,
        },
        data: {
          email: 'new@example.com',
        },
      });

      expect(response.status()).toBe(403);
    });
  });

  test.describe('DELETE /api/users/:id', () => {
    test('should delete user', async ({ request }) => {
      // Create a user to delete
      const testUser = generateTestUser();
      const createResponse = await request.post(`${API_URL}/api/users`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
        data: testUser,
      });

      const userId = (await createResponse.json()).id;

      // Delete the user
      const response = await request.delete(`${API_URL}/api/users/${userId}`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('message', 'User deleted successfully');

      // Verify user is deleted
      const getResponse = await request.get(`${API_URL}/api/users/${userId}`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
      });

      expect(getResponse.status()).toBe(404);
    });

    test('should prevent self-deletion', async ({ request }) => {
      // Get admin user ID by calling /api/auth/me
      const meResponse = await request.get(`${API_URL}/api/auth/me`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
      });

      const adminUserId = (await meResponse.json()).user.userId;

      // Try to delete self
      const response = await request.delete(`${API_URL}/api/users/${adminUserId}`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
      });

      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data.message).toContain('Cannot delete your own account');
    });

    test('should return 404 for non-existent user', async ({ request }) => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request.delete(`${API_URL}/api/users/${fakeId}`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
      });

      expect(response.status()).toBe(404);
    });

    test('should require admin role', async ({ request }) => {
      const viewerUser = generateTestUser();
      await request.post(`${API_URL}/api/auth/register`, { data: viewerUser });

      const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: viewerUser.username,
          password: viewerUser.password,
        },
      });

      const cookies = loginResponse.headers()['set-cookie'];
      const match = cookies?.match(/accessToken=([^;]+)/);
      const viewerToken = match ? match[1] : '';

      const response = await request.delete(`${API_URL}/api/users/${testUserId}`, {
        headers: {
          Cookie: `accessToken=${viewerToken}`,
        },
      });

      expect(response.status()).toBe(403);
    });

    test('should require authentication', async ({ request }) => {
      const response = await request.delete(`${API_URL}/api/users/${testUserId}`);

      expect(response.status()).toBe(401);
    });
  });
});
