import { test, expect } from '@playwright/test';

test.describe('Service health', () => {
  test('API Gateway /health responds (if running)', async ({ request }) => {
    // Pre-flight check for API Gateway availability
    let gatewayAvailable = false;
    try {
      await request.get('http://localhost:3000/health', { timeout: 2000 });
      gatewayAvailable = true;
    } catch {
      gatewayAvailable = false;
    }

    test.skip(!gatewayAvailable, 'API Gateway not running on :3000');

    const resp = await request.get('http://localhost:3000/health');
    // Accept 200 or 503 (degraded) so the test doesn't fail if a downstream is down
    expect([200, 503]).toContain(resp.status());
  });

  test('Main App /health is 200', async ({ request }) => {
    const resp = await request.get('http://localhost:3001/health');
    expect(resp.status()).toBe(200);
  });
});
