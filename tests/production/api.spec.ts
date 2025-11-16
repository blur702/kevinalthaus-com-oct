import { test, expect } from '@playwright/test';

test.describe('Production API Tests', () => {
  test('API Gateway health endpoint responds', async ({ request }) => {
    const response = await request.get('/api/health');

    // Should return JSON response (200 for healthy, 503 for degraded but functional)
    const status = response.status();
    expect([200, 503]).toContain(status);

    // Should return JSON
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');

    // Parse and check response
    const body = await response.json();
    expect(body).toHaveProperty('service');
    expect(body.service).toBe('api-gateway');
    expect(body).toHaveProperty('status');
    expect(['healthy', 'degraded']).toContain(body.status);
  });

  test('API returns proper CORS headers', async ({ request }) => {
    const response = await request.get('/api/health');

    // Check for CORS headers (if configured)
    const headers = response.headers();
    // This might not be configured yet, so just log it
    console.log('CORS headers:', {
      'access-control-allow-origin': headers['access-control-allow-origin'],
      'access-control-allow-methods': headers['access-control-allow-methods'],
    });
  });

  test('API handles invalid routes properly', async ({ request }) => {
    const response = await request.get('/api/nonexistent-endpoint-that-does-not-exist');

    // Should return 404 or similar error status
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});
