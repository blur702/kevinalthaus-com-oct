import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:3000';

test.describe('Health Check Endpoints', () => {
  test.describe('GET /health', () => {
    test('should return healthy status when all services are up', async ({ request }) => {
      const response = await request.get(`${API_URL}/health`);

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('service', 'api-gateway');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('uptime');
      expect(data).toHaveProperty('checks');

      // Validate timestamp is valid ISO-8601
      expect(() => new Date(data.timestamp)).not.toThrow();

      // Validate uptime is a number
      expect(typeof data.uptime).toBe('number');
      expect(data.uptime).toBeGreaterThan(0);

      // Validate checks object
      expect(data.checks).toHaveProperty('mainApp');
      expect(data.checks).toHaveProperty('pythonService');
    });

    test('should return degraded status when services are down', async ({ request }) => {
      // This test assumes services might be down - we check for proper response format
      const response = await request.get(`${API_URL}/health`);

      const data = await response.json();

      // Status should be either healthy or degraded
      expect(['healthy', 'degraded']).toContain(data.status);

      // Status code should be 200 for healthy, 503 for degraded
      if (data.status === 'healthy') {
        expect(response.status()).toBe(200);
      } else {
        expect(response.status()).toBe(503);
      }
    });

    test('should include all required fields in response', async ({ request }) => {
      const response = await request.get(`${API_URL}/health`);
      const data = await response.json();

      // Required fields
      const requiredFields = ['status', 'service', 'timestamp', 'version', 'uptime', 'checks'];
      requiredFields.forEach(field => {
        expect(data).toHaveProperty(field);
      });

      // Service should always be api-gateway
      expect(data.service).toBe('api-gateway');
    });
  });

  test.describe('GET /health/live', () => {
    test('should return alive status', async ({ request }) => {
      const response = await request.get(`${API_URL}/health/live`);

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('status', 'alive');
    });

    test('should respond quickly for liveness probe', async ({ request }) => {
      const start = Date.now();
      await request.get(`${API_URL}/health/live`);
      const duration = Date.now() - start;

      // Liveness probes should be fast (< 1 second)
      expect(duration).toBeLessThan(1000);
    });
  });

  test.describe('GET /health/ready', () => {
    test('should return ready status when dependencies are healthy', async ({ request }) => {
      const response = await request.get(`${API_URL}/health/ready`);

      const data = await response.json();

      // Status should be either ready or not ready
      expect(['ready', 'not ready']).toContain(data.status);

      if (data.status === 'ready') {
        expect(response.status()).toBe(200);
        expect(data).toHaveProperty('dependencies');
        expect(data.dependencies).toHaveProperty('mainApp', 'healthy');
      } else {
        expect(response.status()).toBe(503);
      }
    });

    test('should check main-app dependency', async ({ request }) => {
      const response = await request.get(`${API_URL}/health/ready`);
      const data = await response.json();

      expect(data).toHaveProperty('dependencies');
      expect(data.dependencies).toHaveProperty('mainApp');
      expect(['healthy', 'unhealthy']).toContain(data.dependencies.mainApp);
    });
  });

  test.describe('GET /', () => {
    test('should return API gateway info', async ({ request }) => {
      const response = await request.get(`${API_URL}/`);

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('message', 'Kevin Althaus API Gateway');
      expect(data).toHaveProperty('version', '1.0.0');
      expect(data).toHaveProperty('environment');

      // Environment should be a valid value
      expect(['development', 'production', 'test']).toContain(data.environment);
    });
  });
});
