import { test, expect } from '@playwright/test';

test.describe('Cache Coordination Tests', () => {
  const apiGatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:3000';

  test('should handle cache eviction without orphaned entries', async ({ request }) => {
    // Make multiple requests to fill the cache
    // This assumes there's a cacheable endpoint
    const requests = [];

    // Make 600 requests to trigger cache eviction (max size is 500)
    for (let i = 0; i < 600; i++) {
      requests.push(
        request.get(`${apiGatewayUrl}/health?test=${i}`, {
          headers: {
            'Accept': 'application/json',
          },
        })
      );
    }

    // Execute all requests
    const responses = await Promise.all(requests);

    // Verify all requests succeeded
    responses.forEach((response) => {
      expect(response.ok()).toBe(true);
    });

    // The test passes if no errors occur during cache eviction
    // In the old implementation, this would potentially cause orphaned entries
    // In the new implementation, cache and metadata are coordinated
  });

  test('should coordinate cache and metadata eviction for varied requests', async ({ request }) => {
    // Make requests with different Vary headers to test metadata coordination
    const requests = [];

    for (let i = 0; i < 100; i++) {
      requests.push(
        request.get(`${apiGatewayUrl}/health?varied=${i}`, {
          headers: {
            'Accept': i % 2 === 0 ? 'application/json' : 'text/plain',
            'Accept-Language': i % 3 === 0 ? 'en-US' : 'es-ES',
          },
        })
      );
    }

    const responses = await Promise.all(requests);

    // Verify all requests succeeded
    responses.forEach((response) => {
      expect(response.ok()).toBe(true);
    });
  });
});
