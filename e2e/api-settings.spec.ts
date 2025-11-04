import { test, expect } from '@playwright/test';
import { login, TEST_CREDENTIALS } from './utils/auth';

/**
 * Settings API Tests
 *
 * Test suite covering settings management API endpoints including:
 * - Site settings CRUD
 * - Security settings CRUD
 * - Email settings CRUD
 * - API key management
 * - Authorization checks
 */

test.describe('Settings API', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin before each test
    await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);
  });

  test.describe('Site Settings', () => {
    test('should get site settings', async ({ request }) => {
      const response = await request.get('/api/settings/site');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data).toHaveProperty('site_name');
      expect(data).toHaveProperty('site_description');
      expect(data).toHaveProperty('site_url');
      expect(data).toHaveProperty('timezone');
      expect(data).toHaveProperty('language');
    });

    test('should update site settings', async ({ request }) => {
      const updateData = {
        site_name: 'Test Site Updated',
        site_description: 'Test description updated',
      };

      const response = await request.put('/api/settings/site', {
        data: updateData,
      });
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.site_name).toBe(updateData.site_name);
      expect(data.site_description).toBe(updateData.site_description);
    });

    test('should validate site settings on update', async ({ request }) => {
      const invalidData = {
        site_name: '', // Empty name should fail
      };

      const response = await request.put('/api/settings/site', {
        data: invalidData,
      });
      expect(response.status()).toBe(400);
    });
  });

  test.describe('Security Settings', () => {
    test('should get security settings', async ({ request }) => {
      const response = await request.get('/api/settings/security');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data).toHaveProperty('password_min_length');
      expect(data).toHaveProperty('password_require_uppercase');
      expect(data).toHaveProperty('session_timeout_minutes');
      expect(data).toHaveProperty('max_login_attempts');
      expect(data).toHaveProperty('lockout_duration_minutes');
      expect(data).toHaveProperty('require_2fa');
    });

    test('should update security settings', async ({ request }) => {
      const updateData = {
        password_min_length: 12,
        max_login_attempts: 5,
      };

      const response = await request.put('/api/settings/security', {
        data: updateData,
      });
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.password_min_length).toBe(updateData.password_min_length);
      expect(data.max_login_attempts).toBe(updateData.max_login_attempts);
    });

    test('should validate security settings on update', async ({ request }) => {
      const invalidData = {
        password_min_length: 5, // Too short
      };

      const response = await request.put('/api/settings/security', {
        data: invalidData,
      });
      expect(response.status()).toBe(400);
    });
  });

  test.describe('Email Settings', () => {
    test('should get email settings', async ({ request }) => {
      const response = await request.get('/api/settings/email');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data).toHaveProperty('smtp_host');
      expect(data).toHaveProperty('smtp_port');
      expect(data).toHaveProperty('smtp_secure');
      expect(data).toHaveProperty('smtp_user');
      expect(data).toHaveProperty('smtp_from_email');
      expect(data).toHaveProperty('smtp_from_name');
      // Password should not be returned
      expect(data).not.toHaveProperty('smtp_password');
    });

    test('should update email settings', async ({ request }) => {
      const updateData = {
        smtp_host: 'smtp.test.com',
        smtp_port: 587,
        smtp_user: 'testuser@test.com',
      };

      const response = await request.put('/api/settings/email', {
        data: updateData,
      });
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.smtp_host).toBe(updateData.smtp_host);
      expect(data.smtp_port).toBe(updateData.smtp_port);
      expect(data.smtp_user).toBe(updateData.smtp_user);
    });

    test('should validate email settings on update', async ({ request }) => {
      const invalidData = {
        smtp_port: 99999, // Invalid port
      };

      const response = await request.put('/api/settings/email', {
        data: invalidData,
      });
      expect(response.status()).toBe(400);
    });

    test('should test email settings', async ({ request }) => {
      // Note: This will likely fail without proper SMTP configuration
      // but we're testing the endpoint exists and returns proper structure
      const response = await request.post('/api/settings/email/test');

      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('message');
    });
  });

  test.describe('API Keys', () => {
    let createdKeyId: string;

    test('should get API keys list', async ({ request }) => {
      const response = await request.get('/api/settings/api-keys');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(Array.isArray(data)).toBeTruthy();
    });

    test('should create API key', async ({ request }) => {
      const keyData = {
        name: 'Test API Key',
        scopes: ['read', 'write'],
      };

      const response = await request.post('/api/settings/api-keys', {
        data: keyData,
      });
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('key'); // Full key only returned once
      expect(data).toHaveProperty('key_prefix');
      expect(data.name).toBe(keyData.name);
      expect(data.scopes).toEqual(keyData.scopes);

      createdKeyId = data.id;
    });

    test('should validate API key creation', async ({ request }) => {
      const invalidData = {
        name: '', // Empty name
      };

      const response = await request.post('/api/settings/api-keys', {
        data: invalidData,
      });
      expect(response.status()).toBe(400);
    });

    test('should revoke API key', async ({ request }) => {
      // First create a key
      const keyData = {
        name: 'Test Key to Revoke',
        scopes: ['read'],
      };

      const createResponse = await request.post('/api/settings/api-keys', {
        data: keyData,
      });
      expect(createResponse.ok()).toBeTruthy();

      const createdKey = await createResponse.json();

      // Now revoke it
      const revokeResponse = await request.delete(`/api/settings/api-keys/${createdKey.id}`);
      expect(revokeResponse.ok()).toBeTruthy();

      // Verify it's not in the list
      const listResponse = await request.get('/api/settings/api-keys');
      const keys = await listResponse.json();
      const revokedKey = keys.find((k: { id: string }) => k.id === createdKey.id);
      expect(revokedKey).toBeUndefined();
    });
  });

  test.describe('Authorization', () => {
    test('should require authentication', async ({ request }) => {
      // Create a new context without authentication
      const response = await request.get('/api/settings/site', {
        headers: {
          Cookie: '', // No auth cookies
        },
      });

      expect(response.status()).toBe(401);
    });

    test('should require admin role', async ({ page, request }) => {
      // Note: This test assumes you have a non-admin test user
      // If not, it will be skipped
      test.skip(!process.env.TEST_VIEWER_USERNAME, 'No viewer test user configured');

      await login(page, process.env.TEST_VIEWER_USERNAME!, process.env.TEST_VIEWER_PASSWORD!);

      const response = await request.get('/api/settings/site');
      expect(response.status()).toBe(403);
    });
  });
});
