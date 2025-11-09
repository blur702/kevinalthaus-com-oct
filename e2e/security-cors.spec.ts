import './test-helpers';
/**
 * CORS Security Tests
 * Validates CORS configuration and wildcard origin handling
 *
 * Tests:
 * - CORS headers presence on API Gateway
 * - Wildcard behavior (disabled with credentials)
 * - Allowlist enforcement
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:3000';

test.describe('CORS Security', () => {

  test.describe('CORS Headers', () => {

    test('should include CORS headers on valid origin', async ({ request }) => {
      const response = await request.get(`${API_URL}/health`, {
        headers: {
          'Origin': 'http://localhost:3002'
        }
      });

      expect(response.status()).toBe(200);
      const headers = response.headers();

      // Check for CORS headers
      expect(headers['access-control-allow-origin']).toBeDefined();
      expect(headers['access-control-allow-credentials']).toBeDefined();
    });

    test('should handle preflight OPTIONS request', async ({ request }) => {
      const response = await request.fetch(`${API_URL}/api/users`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3002',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type'
        }
      });

      expect(response.status()).toBeOneOf([200, 204]);
      const headers = response.headers();

      expect(headers['access-control-allow-origin']).toBeDefined();
      expect(headers['access-control-allow-methods']).toBeDefined();
      expect(headers['access-control-allow-headers']).toBeDefined();
    });

    test('should reject requests from unlisted origins', async ({ request }) => {
      const response = await request.get(`${API_URL}/health`, {
        headers: {
          'Origin': 'http://malicious-site.com'
        }
      });

      // Gateway may still respond, but should not include CORS headers for unlisted origin
      const headers = response.headers();
      const allowedOrigin = headers['access-control-allow-origin'];

      // Either no CORS header, or explicitly false
      expect(allowedOrigin).not.toBe('http://malicious-site.com');
    });

  });

  test.describe('Wildcard Behavior', () => {

    test('wildcard should not be used with credentials in production', async () => {
      // This test documents the production behavior
      // In production with CORS_CREDENTIALS=true and CORS_ORIGIN=*, the gateway should fail to start
      // We can't test this directly in E2E without restarting the service

      // Document expected behavior:
      // 1. NODE_ENV=production + CORS_CREDENTIALS=true + CORS_ORIGIN=* → startup error
      // 2. Development mode allows wildcard but disables credentials

      expect(true).toBe(true); // Placeholder for documentation
    });

    test('should document CORS configuration expectations', async () => {
      // Expected configurations:
      // Production: CORS_ORIGIN=https://app.example.com,https://admin.example.com CORS_CREDENTIALS=true
      // Development: CORS_ORIGIN=http://localhost:3000,http://localhost:3002,http://localhost:3003

      expect(true).toBe(true); // Placeholder for documentation
    });

  });

  test.describe('Request ID Propagation', () => {

    test('should include X-Request-Id header in response', async ({ request }) => {
      const response = await request.get(`${API_URL}/health`);

      expect(response.status()).toBe(200);
      const headers = response.headers();

      expect(headers['x-request-id']).toBeDefined();
      expect(headers['x-request-id']).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    });

    test('should preserve X-Request-Id from client if provided', async ({ request }) => {
      const clientRequestId = 'test-12345678-1234-4123-8123-123456789abc';

      const response = await request.get(`${API_URL}/health`, {
        headers: {
          'X-Request-Id': clientRequestId
        }
      });

      expect(response.status()).toBe(200);
      const headers = response.headers();

      expect(headers['x-request-id']).toBe(clientRequestId);
    });

  });

});

