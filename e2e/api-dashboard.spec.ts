/**
 * Comprehensive Dashboard API Tests
 * Tests dashboard statistics endpoint
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Admin credentials
const adminUser = {
  username: 'admin',
  password: 'Admin123!@#'
};

test.describe('Dashboard API - /api/dashboard', () => {

  let adminAccessToken: string;

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

  test.describe('GET /api/dashboard/stats', () => {

    test('should return dashboard statistics', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/dashboard/stats`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.totalUsers).toBeGreaterThanOrEqual(0);
      expect(body.pageViews).toBeGreaterThanOrEqual(0);
      expect(body.articles).toBeGreaterThanOrEqual(0);
      expect(body.growth).toBeDefined();
    });

    test('should include user count', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/dashboard/stats`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(typeof body.totalUsers).toBe('number');
      expect(body.totalUsers).toBeGreaterThan(0); // At least admin user exists
    });

    test('should include page views count', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/dashboard/stats`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(typeof body.pageViews).toBe('number');
      expect(body.pageViews).toBeGreaterThanOrEqual(0);
    });

    test('should include articles count', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/dashboard/stats`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(typeof body.articles).toBe('number');
      expect(body.articles).toBeGreaterThanOrEqual(0);
    });

    test('should include growth metric', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/dashboard/stats`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(typeof body.growth).toBe('number');
    });

    test('should include change percentages', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/dashboard/stats`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.changes).toBeDefined();
      expect(typeof body.changes.users).toBe('string');
      expect(typeof body.changes.views).toBe('string');
      expect(typeof body.changes.articles).toBe('string');
      expect(typeof body.changes.growth).toBe('string');
    });

    test('should format change percentages correctly', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/dashboard/stats`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();

      // Changes should be formatted as percentages with % sign
      expect(body.changes.users).toMatch(/^[+-]?\d+(\.\d+)?%$/);
      expect(body.changes.views).toMatch(/^[+-]?\d+(\.\d+)?%$/);
      expect(body.changes.articles).toMatch(/^[+-]?\d+(\.\d+)?%$/);
      expect(body.changes.growth).toMatch(/^[+-]?\d+(\.\d+)?%$/);
    });

    test('should calculate growth over 30 days', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/dashboard/stats`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();

      // Growth calculation should be based on 30-day comparison
      expect(body.changes).toBeDefined();
    });

    test('should handle missing page_views table gracefully', async ({ request }) => {
      // Even if page_views table doesn't exist, endpoint should work
      const response = await request.get(`${API_URL}/api/dashboard/stats`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.pageViews).toBeDefined();
      expect(typeof body.pageViews).toBe('number');
    });

    test('should handle missing articles table gracefully', async ({ request }) => {
      // Even if articles table doesn't exist, endpoint should work
      const response = await request.get(`${API_URL}/api/dashboard/stats`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.articles).toBeDefined();
      expect(typeof body.articles).toBe('number');
    });

    test('should reject request without authentication', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/dashboard/stats`);

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    test('should reject request without admin role', async ({ request }) => {
      // Create a non-admin user
      const viewerUser = {
        email: `viewer-dashboard-${Date.now()}@example.com`,
        username: `viewerdash${Date.now()}`,
        password: 'Viewer123!@#'
      };

      await request.post(`${API_URL}/api/auth/register`, {
        data: viewerUser
      });

      // Login as viewer
      const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: viewerUser.username,
          password: viewerUser.password
        }
      });

      const cookies = loginResponse.headers()['set-cookie'];
      const match = cookies?.match(/accessToken=([^;]+)/);
      const viewerToken = match ? match[1] : '';

      // Try to access dashboard stats
      const response = await request.get(`${API_URL}/api/dashboard/stats`, {
        headers: {
          Cookie: `accessToken=${viewerToken}`
        }
      });

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Forbidden');
    });

    test('should respond within reasonable time', async ({ request }) => {
      const startTime = Date.now();

      await request.get(`${API_URL}/api/dashboard/stats`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      const duration = Date.now() - startTime;

      // Dashboard stats should respond within 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    test('should handle concurrent requests', async ({ request }) => {
      const promises = Array.from({ length: 5 }, () =>
        request.get(`${API_URL}/api/dashboard/stats`, {
          headers: {
            Cookie: `accessToken=${adminAccessToken}`
          }
        })
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status()).toBe(200);
      });
    });

    test('should return consistent data across multiple requests', async ({ request }) => {
      const response1 = await request.get(`${API_URL}/api/dashboard/stats`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      const response2 = await request.get(`${API_URL}/api/dashboard/stats`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      const body1 = await response1.json();
      const body2 = await response2.json();

      // Stats should be consistent within a short time window
      expect(body1.totalUsers).toBe(body2.totalUsers);
    });

    test('should include all required fields', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/dashboard/stats`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();

      // Check all required fields are present
      expect(body).toHaveProperty('totalUsers');
      expect(body).toHaveProperty('pageViews');
      expect(body).toHaveProperty('articles');
      expect(body).toHaveProperty('growth');
      expect(body).toHaveProperty('changes');
      expect(body.changes).toHaveProperty('users');
      expect(body.changes).toHaveProperty('views');
      expect(body.changes).toHaveProperty('articles');
      expect(body.changes).toHaveProperty('growth');
    });
  });
});
