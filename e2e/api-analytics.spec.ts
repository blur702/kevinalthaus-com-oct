/**
 * Comprehensive Analytics API Tests
 * Tests all analytics endpoints including page views, stats, and top pages
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Admin credentials
const adminUser = {
  username: 'admin',
  password: 'Admin123!@#'
};

test.describe('Analytics API - /api/analytics', () => {

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

  test.describe('GET /api/analytics/page-views', () => {

    test('should get page views with default parameters', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/analytics/page-views`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.limit).toBe(100); // Default limit
      expect(body.pagination.offset).toBe(0);
      expect(body.pagination.total).toBeGreaterThanOrEqual(0);
    });

    test('should get page views with custom limit and offset', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/analytics/page-views?limit=10&offset=5`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.pagination.limit).toBe(10);
      expect(body.pagination.offset).toBe(5);
      expect(body.data.length).toBeLessThanOrEqual(10);
    });

    test('should enforce maximum limit of 1000', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/analytics/page-views?limit=5000`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.pagination.limit).toBe(1000); // Clamped to max
    });

    test('should enforce minimum limit of 1', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/analytics/page-views?limit=0`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.pagination.limit).toBeGreaterThanOrEqual(1);
    });

    test('should filter page views by start date', async ({ request }) => {
      const startDate = '2024-01-01';
      const response = await request.get(`${API_URL}/api/analytics/page-views?startDate=${startDate}`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.filters.startDate).toBe(startDate);
    });

    test('should filter page views by end date', async ({ request }) => {
      const endDate = '2024-12-31';
      const response = await request.get(`${API_URL}/api/analytics/page-views?endDate=${endDate}`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.filters.endDate).toBe(endDate);
    });

    test('should filter page views by path', async ({ request }) => {
      const path = '/api/%';
      const response = await request.get(`${API_URL}/api/analytics/page-views?path=${encodeURIComponent(path)}`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.filters.path).toBe(path);
    });

    test('should filter page views by userId', async ({ request }) => {
      // Get a valid user ID first
      const usersResponse = await request.get(`${API_URL}/api/users?limit=1`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });
      const usersBody = await usersResponse.json();
      const userId = usersBody.users[0]?.id;

      if (userId) {
        const response = await request.get(`${API_URL}/api/analytics/page-views?userId=${userId}`, {
          headers: {
            Cookie: `accessToken=${adminAccessToken}`
          }
        });

        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.filters.userId).toBe(userId);
      }
    });

    test('should group page views by hour', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/analytics/page-views?groupBy=hour`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.filters.groupBy).toBe('hour');

      if (body.data.length > 0) {
        expect(body.data[0]).toHaveProperty('period');
        expect(body.data[0]).toHaveProperty('count');
        expect(body.data[0]).toHaveProperty('unique_users');
      }
    });

    test('should group page views by day', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/analytics/page-views?groupBy=day`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.filters.groupBy).toBe('day');
    });

    test('should group page views by week', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/analytics/page-views?groupBy=week`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.filters.groupBy).toBe('week');
    });

    test('should group page views by month', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/analytics/page-views?groupBy=month`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.filters.groupBy).toBe('month');
    });

    test('should reject invalid groupBy value', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/analytics/page-views?groupBy=invalid`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('Invalid groupBy value');
    });

    test('should reject request without authentication', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/analytics/page-views`);

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    test('should reject request without admin role', async ({ request }) => {
      // Create a non-admin user
      const viewerUser = {
        email: `viewer-${Date.now()}@example.com`,
        username: `viewer${Date.now()}`,
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

      // Try to access analytics
      const response = await request.get(`${API_URL}/api/analytics/page-views`, {
        headers: {
          Cookie: `accessToken=${viewerToken}`
        }
      });

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Forbidden');
    });
  });

  test.describe('GET /api/analytics/page-views/stats', () => {

    test('should get page view statistics', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/analytics/page-views/stats`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.stats).toBeDefined();
      expect(body.stats.total_views).toBeGreaterThanOrEqual(0);
      expect(body.stats.unique_visitors).toBeGreaterThanOrEqual(0);
      expect(body.stats.views_today).toBeGreaterThanOrEqual(0);
      expect(body.stats.views_this_week).toBeGreaterThanOrEqual(0);
      expect(body.stats.views_this_month).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(body.stats.top_pages)).toBe(true);
    });

    test('should include top pages in stats', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/analytics/page-views/stats`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();

      if (body.stats.top_pages.length > 0) {
        expect(body.stats.top_pages[0]).toHaveProperty('path');
        expect(body.stats.top_pages[0]).toHaveProperty('views');
        expect(body.stats.top_pages[0].views).toBeGreaterThan(0);
      }
    });

    test('should limit top pages to 10', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/analytics/page-views/stats`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.stats.top_pages.length).toBeLessThanOrEqual(10);
    });

    test('should reject stats request without authentication', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/analytics/page-views/stats`);

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    test('should reject stats request without admin role', async ({ request }) => {
      // Create a non-admin user
      const viewerUser = {
        email: `viewer-stats-${Date.now()}@example.com`,
        username: `viewerstats${Date.now()}`,
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

      // Try to access stats
      const response = await request.get(`${API_URL}/api/analytics/page-views/stats`, {
        headers: {
          Cookie: `accessToken=${viewerToken}`
        }
      });

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Forbidden');
    });
  });

  test.describe('GET /api/analytics/page-views/top-pages', () => {

    test('should get top pages with default limit', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/analytics/page-views/top-pages`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.filters.limit).toBe(10); // Default limit
    });

    test('should get top pages with custom limit', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/analytics/page-views/top-pages?limit=5`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.filters.limit).toBe(5);
      expect(body.data.length).toBeLessThanOrEqual(5);
    });

    test('should enforce maximum limit of 100', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/analytics/page-views/top-pages?limit=500`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.filters.limit).toBe(100); // Clamped to max
    });

    test('should filter top pages by start date', async ({ request }) => {
      const startDate = '2024-01-01';
      const response = await request.get(`${API_URL}/api/analytics/page-views/top-pages?startDate=${startDate}`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.filters.startDate).toBe(startDate);
    });

    test('should filter top pages by end date', async ({ request }) => {
      const endDate = '2024-12-31';
      const response = await request.get(`${API_URL}/api/analytics/page-views/top-pages?endDate=${endDate}`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.filters.endDate).toBe(endDate);
    });

    test('should include views and unique visitors for each page', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/analytics/page-views/top-pages`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();

      if (body.data.length > 0) {
        expect(body.data[0]).toHaveProperty('path');
        expect(body.data[0]).toHaveProperty('views');
        expect(body.data[0]).toHaveProperty('unique_visitors');
        expect(body.data[0].views).toBeGreaterThan(0);
      }
    });

    test('should sort top pages by views descending', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/analytics/page-views/top-pages`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();

      if (body.data.length > 1) {
        for (let i = 0; i < body.data.length - 1; i++) {
          expect(body.data[i].views).toBeGreaterThanOrEqual(body.data[i + 1].views);
        }
      }
    });

    test('should reject top pages request without authentication', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/analytics/page-views/top-pages`);

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    test('should reject top pages request without admin role', async ({ request }) => {
      // Create a non-admin user
      const viewerUser = {
        email: `viewer-top-${Date.now()}@example.com`,
        username: `viewertop${Date.now()}`,
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

      // Try to access top pages
      const response = await request.get(`${API_URL}/api/analytics/page-views/top-pages`, {
        headers: {
          Cookie: `accessToken=${viewerToken}`
        }
      });

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Forbidden');
    });
  });
});
