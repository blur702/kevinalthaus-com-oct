/**
 * Comprehensive Users API Tests
 * Tests all user management endpoints including list, get, create, update, and delete
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Admin credentials
const adminUser = {
  username: 'admin',
  password: 'Admin123!@#'
};

// Test user data
const testUser = {
  email: `testuser-${Date.now()}@example.com`,
  username: `testuser${Date.now()}`,
  password: 'Test123!@#',
  role: 'viewer'
};

test.describe('Users API - /api/users', () => {

  let adminAccessToken: string;
  let createdUserId: string;

  test.beforeAll(async ({ request }) => {
    // Login as admin to get access token
    const response = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        username: adminUser.username,
        password: adminUser.password
      }
    });

    const cookies = response.headers()['set-cookie'];
    const match = cookies?.match(/accessToken=([^;]+)/);
    adminAccessToken = match ? match[1] : '';
  });

  test.describe('GET /api/users', () => {

    test('should list users with default pagination', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/users`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.users).toBeDefined();
      expect(Array.isArray(body.users)).toBe(true);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(10);
      expect(body.pagination.total).toBeGreaterThan(0);
    });

    test('should list users with custom pagination', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/users?page=1&limit=5`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(5);
      expect(body.users.length).toBeLessThanOrEqual(5);
    });

    test('should search users by email', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/users?email=admin`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.users).toBeDefined();
      body.users.forEach((user: { email: string }) => {
        expect(user.email.toLowerCase()).toContain('admin');
      });
    });

    test('should search users by username', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/users?username=admin`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.users).toBeDefined();
      body.users.forEach((user: { username: string }) => {
        expect(user.username.toLowerCase()).toContain('admin');
      });
    });

    test('should filter users by role', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/users?role=admin`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.users).toBeDefined();
      body.users.forEach((user: { role: string }) => {
        expect(user.role).toBe('admin');
      });
    });

    test('should filter users by active status', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/users?active=true`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.users).toBeDefined();
      body.users.forEach((user: { is_active: boolean }) => {
        expect(user.is_active).toBe(true);
      });
    });

    test('should reject list users without authentication', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/users`);

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    test('should reject list users with invalid role filter', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/users?role=invalid_role`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Invalid role');
    });
  });

  test.describe('GET /api/users/:id', () => {

    test('should get user by valid ID', async ({ request }) => {
      // First, get a list of users to get a valid ID
      const listResponse = await request.get(`${API_URL}/api/users?limit=1`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });
      const listBody = await listResponse.json();
      const userId = listBody.users[0].id;

      // Get specific user
      const response = await request.get(`${API_URL}/api/users/${userId}`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.user).toBeDefined();
      expect(body.user.id).toBe(userId);
      expect(body.user.email).toBeDefined();
      expect(body.user.username).toBeDefined();
      expect(body.user.role).toBeDefined();
    });

    test('should return 404 for non-existent user ID', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/users/00000000-0000-0000-0000-000000000000`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Not Found');
      expect(body.message).toContain('User not found');
    });

    test('should reject get user without authentication', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/users/some-id`);

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });
  });

  test.describe('POST /api/users', () => {

    test('should create new user with valid data (admin only)', async ({ request }) => {
      const newUser = {
        email: testUser.email,
        username: testUser.username,
        password: testUser.password,
        role: testUser.role
      };

      const response = await request.post(`${API_URL}/api/users`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: newUser
      });

      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.message).toBe('User created successfully');
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe(newUser.email);
      expect(body.user.username).toBe(newUser.username);
      expect(body.user.role).toBe(newUser.role);
      expect(body.user.id).toBeDefined();

      // Store created user ID for later tests
      createdUserId = body.user.id;
    });

    test('should create admin user when role specified', async ({ request }) => {
      const adminUserData = {
        email: `admin-${Date.now()}@example.com`,
        username: `admin${Date.now()}`,
        password: 'Admin123!@#',
        role: 'admin'
      };

      const response = await request.post(`${API_URL}/api/users`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: adminUserData
      });

      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.user.role).toBe('admin');
    });

    test('should reject user creation with missing email', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/users`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          username: 'testuser',
          password: 'Test123!@#'
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Bad Request');
    });

    test('should reject user creation with missing username', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/users`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          email: 'test@example.com',
          password: 'Test123!@#'
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Bad Request');
    });

    test('should reject user creation with missing password', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/users`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          email: 'test@example.com',
          username: 'testuser'
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Bad Request');
    });

    test('should reject user creation with invalid email', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/users`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          email: 'invalid-email',
          username: 'testuser',
          password: 'Test123!@#'
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.message).toContain('Invalid email');
    });

    test('should reject user creation with invalid username format', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/users`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          email: 'test@example.com',
          username: 'ab', // Too short
          password: 'Test123!@#'
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.message).toContain('Username must be 3-30 characters');
    });

    test('should reject user creation with invalid role', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/users`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          email: 'test@example.com',
          username: 'testuser',
          password: 'Test123!@#',
          role: 'invalid_role'
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.message).toContain('Invalid role');
    });

    test('should reject user creation with duplicate email', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/users`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          email: testUser.email, // Already created above
          username: `different${Date.now()}`,
          password: 'Test123!@#'
        }
      });

      expect(response.status()).toBe(409);
      const body = await response.json();
      expect(body.error).toBe('Conflict');
      expect(body.message).toContain('Email already exists');
    });

    test('should reject user creation with duplicate username', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/users`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          email: `different-${Date.now()}@example.com`,
          username: testUser.username, // Already created above
          password: 'Test123!@#'
        }
      });

      expect(response.status()).toBe(409);
      const body = await response.json();
      expect(body.error).toBe('Conflict');
      expect(body.message).toContain('Username already exists');
    });

    test('should reject user creation without admin authentication', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/users`, {
        data: {
          email: 'test@example.com',
          username: 'testuser',
          password: 'Test123!@#'
        }
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });
  });

  test.describe('PATCH /api/users/:id', () => {

    test('should update user email', async ({ request }) => {
      const newEmail = `updated-${Date.now()}@example.com`;

      const response = await request.patch(`${API_URL}/api/users/${createdUserId}`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          email: newEmail
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.message).toBe('User updated successfully');
      expect(body.user.email).toBe(newEmail);
    });

    test('should update user username', async ({ request }) => {
      const newUsername = `updated${Date.now()}`;

      const response = await request.patch(`${API_URL}/api/users/${createdUserId}`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          username: newUsername
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.message).toBe('User updated successfully');
      expect(body.user.username).toBe(newUsername);
    });

    test('should update user role', async ({ request }) => {
      const response = await request.patch(`${API_URL}/api/users/${createdUserId}`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          role: 'editor'
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.message).toBe('User updated successfully');
      expect(body.user.role).toBe('editor');
    });

    test('should update user active status', async ({ request }) => {
      const response = await request.patch(`${API_URL}/api/users/${createdUserId}`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          is_active: false
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.message).toBe('User updated successfully');
      expect(body.user.is_active).toBe(false);

      // Reactivate for cleanup
      await request.patch(`${API_URL}/api/users/${createdUserId}`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          is_active: true
        }
      });
    });

    test('should update multiple fields at once', async ({ request }) => {
      const updates = {
        email: `multi-update-${Date.now()}@example.com`,
        role: 'viewer'
      };

      const response = await request.patch(`${API_URL}/api/users/${createdUserId}`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: updates
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.user.email).toBe(updates.email);
      expect(body.user.role).toBe(updates.role);
    });

    test('should reject update with no fields', async ({ request }) => {
      const response = await request.patch(`${API_URL}/api/users/${createdUserId}`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {}
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.message).toContain('No fields to update');
    });

    test('should reject update with invalid email', async ({ request }) => {
      const response = await request.patch(`${API_URL}/api/users/${createdUserId}`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          email: 'invalid-email'
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.message).toContain('Invalid email');
    });

    test('should reject update with invalid username format', async ({ request }) => {
      const response = await request.patch(`${API_URL}/api/users/${createdUserId}`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          username: 'ab' // Too short
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.message).toContain('Username must be 3-30 characters');
    });

    test('should reject update with invalid role', async ({ request }) => {
      const response = await request.patch(`${API_URL}/api/users/${createdUserId}`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          role: 'invalid_role'
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.message).toContain('Invalid role');
    });

    test('should return 404 for non-existent user', async ({ request }) => {
      const response = await request.patch(`${API_URL}/api/users/00000000-0000-0000-0000-000000000000`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          email: 'test@example.com'
        }
      });

      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Not Found');
    });

    test('should reject update without admin authentication', async ({ request }) => {
      const response = await request.patch(`${API_URL}/api/users/${createdUserId}`, {
        data: {
          email: 'test@example.com'
        }
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });
  });

  test.describe('DELETE /api/users/:id', () => {

    test('should delete user successfully', async ({ request }) => {
      const response = await request.delete(`${API_URL}/api/users/${createdUserId}`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.message).toBe('User deleted successfully');
    });

    test('should return 404 when deleting already deleted user', async ({ request }) => {
      const response = await request.delete(`${API_URL}/api/users/${createdUserId}`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Not Found');
    });

    test('should return 404 for non-existent user', async ({ request }) => {
      const response = await request.delete(`${API_URL}/api/users/00000000-0000-0000-0000-000000000000`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Not Found');
    });

    test('should reject delete without admin authentication', async ({ request }) => {
      const response = await request.delete(`${API_URL}/api/users/some-id`);

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });
  });
});
