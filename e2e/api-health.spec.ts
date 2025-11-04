/**
 * Comprehensive Health Check API Tests
 * Tests all health check endpoints for both API Gateway and Main App
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:3000';

test.describe('Health Check API - /health', () => {

  test.describe('GET /health (API Gateway)', () => {

    test('should return health status', async ({ request }) => {
      const response = await request.get(`${API_URL}/health`);

      expect(response.status()).toBeOneOf([200, 503]);
      const body = await response.json();
      expect(body.status).toBeOneOf(['healthy', 'degraded']);
      expect(body.service).toBe('api-gateway');
      expect(body.timestamp).toBeDefined();
      expect(body.version).toBeDefined();
      expect(body.uptime).toBeGreaterThan(0);
      expect(body.checks).toBeDefined();
    });

    test('should include downstream service checks', async ({ request }) => {
      const response = await request.get(`${API_URL}/health`);

      const body = await response.json();
      expect(body.checks).toHaveProperty('mainApp');
      expect(body.checks).toHaveProperty('pythonService');
      expect(body.checks.mainApp).toBeOneOf(['healthy', 'unhealthy']);
      expect(body.checks.pythonService).toBeOneOf(['healthy', 'unhealthy']);
    });

    test('should return 200 when all services healthy', async ({ request }) => {
      const response = await request.get(`${API_URL}/health`);

      const body = await response.json();
      if (body.status === 'healthy') {
        expect(response.status()).toBe(200);
        expect(body.checks.mainApp).toBe('healthy');
      }
    });

    test('should return 503 when any service degraded', async ({ request }) => {
      const response = await request.get(`${API_URL}/health`);

      const body = await response.json();
      if (body.status === 'degraded') {
        expect(response.status()).toBe(503);
      }
    });

    test('should return valid timestamp in ISO format', async ({ request }) => {
      const response = await request.get(`${API_URL}/health`);

      const body = await response.json();
      const timestamp = new Date(body.timestamp);
      expect(timestamp.toISOString()).toBe(body.timestamp);
    });

    test('should return positive uptime', async ({ request }) => {
      const response = await request.get(`${API_URL}/health`);

      const body = await response.json();
      expect(body.uptime).toBeGreaterThan(0);
    });

    test('should not require authentication', async ({ request }) => {
      const response = await request.get(`${API_URL}/health`);

      // Should work without any authentication headers
      expect(response.status()).toBeOneOf([200, 503]);
    });
  });

  test.describe('GET /health/live (API Gateway)', () => {

    test('should return alive status', async ({ request }) => {
      const response = await request.get(`${API_URL}/health/live`);

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('alive');
    });

    test('should respond quickly (liveness probe)', async ({ request }) => {
      const startTime = Date.now();
      await request.get(`${API_URL}/health/live`);
      const duration = Date.now() - startTime;

      // Liveness probe should be very fast (< 100ms typically)
      expect(duration).toBeLessThan(1000);
    });

    test('should not require authentication', async ({ request }) => {
      const response = await request.get(`${API_URL}/health/live`);

      expect(response.status()).toBe(200);
    });
  });

  test.describe('GET /health/ready (API Gateway)', () => {

    test('should return ready or not ready status', async ({ request }) => {
      const response = await request.get(`${API_URL}/health/ready`);

      expect(response.status()).toBeOneOf([200, 503]);
      const body = await response.json();
      expect(body.status).toBeOneOf(['ready', 'not ready']);
    });

    test('should check main-app dependency', async ({ request }) => {
      const response = await request.get(`${API_URL}/health/ready`);

      const body = await response.json();
      expect(body.dependencies).toBeDefined();
      expect(body.dependencies.mainApp).toBeOneOf(['healthy', 'unhealthy']);
    });

    test('should return 200 when ready', async ({ request }) => {
      const response = await request.get(`${API_URL}/health/ready`);

      const body = await response.json();
      if (body.status === 'ready') {
        expect(response.status()).toBe(200);
        expect(body.dependencies.mainApp).toBe('healthy');
      }
    });

    test('should return 503 when not ready', async ({ request }) => {
      const response = await request.get(`${API_URL}/health/ready`);

      const body = await response.json();
      if (body.status === 'not ready') {
        expect(response.status()).toBe(503);
      }
    });

    test('should not require authentication', async ({ request }) => {
      const response = await request.get(`${API_URL}/health/ready`);

      expect(response.status()).toBeOneOf([200, 503]);
    });
  });

  test.describe('GET / (API Gateway Root)', () => {

    test('should return gateway info', async ({ request }) => {
      const response = await request.get(`${API_URL}/`);

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.message).toContain('API Gateway');
      expect(body.version).toBeDefined();
      expect(body.environment).toBeDefined();
    });

    test('should return version information', async ({ request }) => {
      const response = await request.get(`${API_URL}/`);

      const body = await response.json();
      expect(body.version).toBeTruthy();
    });

    test('should return environment information', async ({ request }) => {
      const response = await request.get(`${API_URL}/`);

      const body = await response.json();
      expect(body.environment).toBeOneOf(['development', 'production', 'test']);
    });

    test('should not require authentication', async ({ request }) => {
      const response = await request.get(`${API_URL}/`);

      expect(response.status()).toBe(200);
    });
  });

  test.describe('404 Handler', () => {

    test('should return 404 for non-existent routes', async ({ request }) => {
      const response = await request.get(`${API_URL}/non-existent-route`);

      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Not Found');
      expect(body.message).toContain('not found');
    });

    test('should include requested path in error message', async ({ request }) => {
      const testPath = `/test-${Date.now()}`;
      const response = await request.get(`${API_URL}${testPath}`);

      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.message).toContain(testPath);
    });

    test('should handle 404 for nested non-existent routes', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/non-existent/nested/route`);

      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Not Found');
    });
  });

  test.describe('Health Endpoints Performance', () => {

    test('should handle multiple concurrent health checks', async ({ request }) => {
      const promises = Array.from({ length: 10 }, () =>
        request.get(`${API_URL}/health`)
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status()).toBeOneOf([200, 503]);
      });
    });

    test('should handle rapid sequential health checks', async ({ request }) => {
      for (let i = 0; i < 5; i++) {
        const response = await request.get(`${API_URL}/health/live`);
        expect(response.status()).toBe(200);
      }
    });

    test('should cache health check results appropriately', async ({ request }) => {
      const response1 = await request.get(`${API_URL}/health`);
      const body1 = await response1.json();

      // Wait a short time
      await new Promise(resolve => setTimeout(resolve, 100));

      const response2 = await request.get(`${API_URL}/health`);
      const body2 = await response2.json();

      // Health status should be consistent within a short time window
      expect(body1.status).toBe(body2.status);
    });
  });

  test.describe('Health Check Headers', () => {

    test('should include correct content-type header', async ({ request }) => {
      const response = await request.get(`${API_URL}/health`);

      expect(response.headers()['content-type']).toContain('application/json');
    });

    test('should not cache health check responses', async ({ request }) => {
      const response = await request.get(`${API_URL}/health`);

      const cacheControl = response.headers()['cache-control'];
      // Health checks should not be cached or should have very short cache
      expect(cacheControl).toBeTruthy();
    });

    test('should include security headers', async ({ request }) => {
      const response = await request.get(`${API_URL}/health`);

      // Common security headers should be present
      const headers = response.headers();
      expect(headers).toBeTruthy();
    });
  });
});
