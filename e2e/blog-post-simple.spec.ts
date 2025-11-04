import { test, expect } from '@playwright/test';
import { login, TEST_CREDENTIALS, apiRequest } from './utils/auth';

/**
 * Simple Blog Post Test
 * Tests blog post creation through authenticated API
 */

test.describe('Blog Post API', () => {
  test.beforeEach(async ({ page }) => {
    await login(
      page,
      TEST_CREDENTIALS.ADMIN.username,
      TEST_CREDENTIALS.ADMIN.password
    );
  });

  test('should create a blog post via authenticated API', async ({ page }) => {
    // Debug: Check ALL cookies in context with full details
    const allCookies = await page.context().cookies();
    console.log('\n=== ALL COOKIES IN CONTEXT ===');
    allCookies.forEach(c => {
      console.log(`Cookie: ${c.name}`);
      console.log(`  Domain: ${c.domain}`);
      console.log(`  Path: ${c.path}`);
      console.log(`  Secure: ${c.secure}`);
      console.log(`  HttpOnly: ${c.httpOnly}`);
      console.log(`  SameSite: ${c.sameSite}`);
      console.log(`  Value: ${c.value.substring(0, 30)}...`);
    });

    // Debug: Check cookies for specific URL
    const urlCookies = await page.context().cookies('http://localhost:3003/api/blog');
    console.log(`\n=== COOKIES FOR http://localhost:3003/api/blog ===`);
    console.log(`Count: ${urlCookies.length}`);
    urlCookies.forEach(c => console.log(`  - ${c.name}`));

    // Debug: Current page URL
    console.log(`\n=== CURRENT PAGE ===`);
    console.log(`URL: ${page.url()}`);

    // Debug: Try making request directly in the browser to see what headers are sent
    const requestDebug = await page.evaluate(async () => {
      const response = await fetch('/api/blog', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Test Blog Post',
          body_html: '<p>This is a test post.</p>',
          excerpt: 'A test post',
          status: 'draft',
        }),
        credentials: 'include',
      });

      return {
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        // Get document.cookie to see what cookies are available
        cookies: document.cookie,
      };
    });

    console.log('\n=== REQUEST DEBUG ===');
    console.log('Response status:', requestDebug.status);
    console.log('Response ok:', requestDebug.ok);
    console.log('Document cookies:', requestDebug.cookies);

    // Create a blog post using apiRequest helper
    const createResponse = await apiRequest(page, '/api/blog', {
      method: 'POST',
      body: {
        title: 'Test Blog Post',
        body_html: '<p>This is a test post.</p>',
        excerpt: 'A test post',
        status: 'draft',
      },
    });

    console.log('\n=== APIRESQUEST RESULT ===');
    console.log('Response status:', createResponse.status);
    console.log('Response ok:', createResponse.ok);
    const responseBody = await createResponse.json();
    console.log('Response body:', responseBody);

    expect(createResponse.ok).toBeTruthy();
    expect(responseBody).toHaveProperty('id');
    expect(responseBody.title).toBe('Test Blog Post');
  });
});
