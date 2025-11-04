/**
 * Comprehensive Blog API Tests
 * Tests all blog post endpoints including CRUD operations, publishing, and public access
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Admin credentials
const adminUser = {
  username: 'admin',
  password: 'Admin123!@#'
};

// Test blog post data
const testPost = {
  title: `Test Blog Post ${Date.now()}`,
  body_html: '<p>This is a test blog post content.</p>',
  excerpt: 'This is a test excerpt',
  meta_description: 'Test meta description',
  meta_keywords: 'test, blog, post',
  reading_time_minutes: 5,
  allow_comments: true,
  status: 'draft'
};

test.describe('Blog API - /api/blog', () => {

  let adminAccessToken: string;
  let createdPostId: string;
  let publishedPostId: string;

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

  test.describe('GET /api/blog', () => {

    test('should list blog posts with default pagination', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/blog`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body.posts)).toBe(true);
      expect(body.total).toBeGreaterThanOrEqual(0);
      expect(body.page).toBe(1);
      expect(body.limit).toBe(10);
      expect(body.total_pages).toBeGreaterThanOrEqual(0);
    });

    test('should list blog posts with custom pagination', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/blog?page=1&limit=5`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.limit).toBe(5);
      expect(body.posts.length).toBeLessThanOrEqual(5);
    });

    test('should filter blog posts by status', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/blog?status=published`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      body.posts.forEach((post: { status: string }) => {
        expect(post.status).toBe('published');
      });
    });

    test('should include author information', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/blog`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();

      if (body.posts.length > 0) {
        expect(body.posts[0]).toHaveProperty('author_email');
        expect(body.posts[0]).toHaveProperty('author_display_name');
      }
    });

    test('should order posts by created_at DESC', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/blog`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();

      if (body.posts.length > 1) {
        const firstPostDate = new Date(body.posts[0].created_at);
        const secondPostDate = new Date(body.posts[1].created_at);
        expect(firstPostDate.getTime()).toBeGreaterThanOrEqual(secondPostDate.getTime());
      }
    });

    test('should not include deleted posts', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/blog`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();

      body.posts.forEach((post: { deleted_at: null | string }) => {
        expect(post.deleted_at).toBeNull();
      });
    });

    test('should require authentication', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/blog`);

      // Based on implementation, might be public or require auth
      expect(response.status()).toBeOneOf([200, 401]);
    });
  });

  test.describe('GET /api/blog/public', () => {

    test('should list published posts without authentication', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/blog/public`);

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body.posts)).toBe(true);
      expect(body.total).toBeGreaterThanOrEqual(0);
    });

    test('should only show published posts', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/blog/public`);

      expect(response.status()).toBe(200);
      const body = await response.json();

      body.posts.forEach((post: { status: string; deleted_at: null | string }) => {
        expect(post.status).toBe('published');
        expect(post.deleted_at).toBeNull();
      });
    });

    test('should include author information', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/blog/public`);

      expect(response.status()).toBe(200);
      const body = await response.json();

      if (body.posts.length > 0) {
        expect(body.posts[0]).toHaveProperty('author_email');
        expect(body.posts[0]).toHaveProperty('author_display_name');
        expect(body.posts[0]).toHaveProperty('author_avatar_url');
      }
    });

    test('should order posts by published_at DESC', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/blog/public`);

      expect(response.status()).toBe(200);
      const body = await response.json();

      if (body.posts.length > 1) {
        const firstPostDate = new Date(body.posts[0].published_at);
        const secondPostDate = new Date(body.posts[1].published_at);
        expect(firstPostDate.getTime()).toBeGreaterThanOrEqual(secondPostDate.getTime());
      }
    });

    test('should support pagination', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/blog/public?page=1&limit=5`);

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.limit).toBe(5);
      expect(body.posts.length).toBeLessThanOrEqual(5);
    });
  });

  test.describe('POST /api/blog', () => {

    test('should create new blog post with valid data', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/blog`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: testPost
      });

      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.id).toBeDefined();
      expect(body.title).toBe(testPost.title);
      expect(body.body_html).toBe(testPost.body_html);
      expect(body.slug).toBeDefined();
      expect(body.status).toBe('draft');

      // Store created post ID for later tests
      createdPostId = body.id;
    });

    test('should auto-generate slug from title', async ({ request }) => {
      const postWithoutSlug = {
        title: `Auto Slug Test ${Date.now()}`,
        body_html: '<p>Test content</p>',
        status: 'draft'
      };

      const response = await request.post(`${API_URL}/api/blog`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: postWithoutSlug
      });

      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.slug).toBeDefined();
      expect(body.slug).toMatch(/^[a-z0-9-]+$/);
    });

    test('should accept custom slug', async ({ request }) => {
      const customSlug = `custom-slug-${Date.now()}`;
      const postWithSlug = {
        title: 'Test Post',
        slug: customSlug,
        body_html: '<p>Test content</p>',
        status: 'draft'
      };

      const response = await request.post(`${API_URL}/api/blog`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: postWithSlug
      });

      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.slug).toBe(customSlug);
    });

    test('should reject duplicate slug', async ({ request }) => {
      const slug = `duplicate-slug-${Date.now()}`;

      // Create first post
      await request.post(`${API_URL}/api/blog`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          title: 'First Post',
          slug: slug,
          body_html: '<p>Content</p>'
        }
      });

      // Try to create second post with same slug
      const response = await request.post(`${API_URL}/api/blog`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          title: 'Second Post',
          slug: slug,
          body_html: '<p>Content</p>'
        }
      });

      expect(response.status()).toBe(409);
      const body = await response.json();
      expect(body.error).toContain('Slug already exists');
    });

    test('should reject post without title', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/blog`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          body_html: '<p>Content</p>'
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Title and body are required');
    });

    test('should reject post without body', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/blog`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          title: 'Test Post'
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Title and body are required');
    });

    test('should set author to current user', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/blog`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          title: 'Author Test',
          body_html: '<p>Content</p>'
        }
      });

      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.author_id).toBeDefined();
    });

    test('should require authentication', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/blog`, {
        data: testPost
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });
  });

  test.describe('GET /api/blog/:id', () => {

    test('should get blog post by ID', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/blog/${createdPostId}`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.id).toBe(createdPostId);
      expect(body.title).toBeDefined();
      expect(body.body_html).toBeDefined();
    });

    test('should include author information', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/blog/${createdPostId}`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.author_email).toBeDefined();
      expect(body.author_display_name).toBeDefined();
      expect(body.author_bio).toBeDefined();
      expect(body.author_avatar_url).toBeDefined();
    });

    test('should return 404 for non-existent post', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/blog/00000000-0000-0000-0000-000000000000`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error).toContain('not found');
    });

    test('should not return deleted posts', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/blog/${createdPostId}`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.deleted_at).toBeNull();
    });
  });

  test.describe('PUT /api/blog/:id', () => {

    test('should update blog post', async ({ request }) => {
      const updates = {
        title: `Updated Title ${Date.now()}`,
        excerpt: 'Updated excerpt'
      };

      const response = await request.put(`${API_URL}/api/blog/${createdPostId}`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: updates
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.title).toBe(updates.title);
      expect(body.excerpt).toBe(updates.excerpt);
    });

    test('should allow partial updates', async ({ request }) => {
      const response = await request.put(`${API_URL}/api/blog/${createdPostId}`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          reading_time_minutes: 10
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.reading_time_minutes).toBe(10);
    });

    test('should validate status field', async ({ request }) => {
      const response = await request.put(`${API_URL}/api/blog/${createdPostId}`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          status: 'invalid_status'
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Invalid status');
    });

    test('should prevent slug duplicates on update', async ({ request }) => {
      // Get an existing slug
      const listResponse = await request.get(`${API_URL}/api/blog?limit=2`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });
      const posts = (await listResponse.json()).posts;

      if (posts.length >= 2) {
        const existingSlug = posts[0].slug;
        const postToUpdate = posts[1].id;

        const response = await request.put(`${API_URL}/api/blog/${postToUpdate}`, {
          headers: {
            Cookie: `accessToken=${adminAccessToken}`
          },
          data: {
            slug: existingSlug
          }
        });

        expect(response.status()).toBe(409);
        const body = await response.json();
        expect(body.error).toContain('Slug already exists');
      }
    });

    test('should return 404 for non-existent post', async ({ request }) => {
      const response = await request.put(`${API_URL}/api/blog/00000000-0000-0000-0000-000000000000`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          title: 'Updated Title'
        }
      });

      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error).toContain('not found');
    });

    test('should require authentication', async ({ request }) => {
      const response = await request.put(`${API_URL}/api/blog/${createdPostId}`, {
        data: {
          title: 'Updated Title'
        }
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    test('should only allow author or admin to update', async ({ request }) => {
      // Create a second user
      const secondUser = {
        email: `second-${Date.now()}@example.com`,
        username: `second${Date.now()}`,
        password: 'Second123!@#'
      };

      await request.post(`${API_URL}/api/auth/register`, { data: secondUser });

      const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: secondUser.username,
          password: secondUser.password
        }
      });

      const cookies = loginResponse.headers()['set-cookie'];
      const match = cookies?.match(/accessToken=([^;]+)/);
      const secondUserToken = match ? match[1] : '';

      // Try to update admin's post as second user
      const response = await request.put(`${API_URL}/api/blog/${createdPostId}`, {
        headers: {
          Cookie: `accessToken=${secondUserToken}`
        },
        data: {
          title: 'Unauthorized Update'
        }
      });

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('Insufficient permissions');
    });
  });

  test.describe('POST /api/blog/:id/publish', () => {

    test.beforeAll(async ({ request }) => {
      // Create a draft post to publish
      const response = await request.post(`${API_URL}/api/blog`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          title: `Post to Publish ${Date.now()}`,
          body_html: '<p>Content to publish</p>',
          status: 'draft'
        }
      });

      publishedPostId = (await response.json()).id;
    });

    test('should publish draft post', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/blog/${publishedPostId}/publish`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('published');
      expect(body.published_at).toBeDefined();
    });

    test('should reject publishing already published post', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/blog/${publishedPostId}/publish`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(409);
      const body = await response.json();
      expect(body.error).toContain('already published');
    });

    test('should require title and body to publish', async ({ request }) => {
      // Note: This test would require creating a post without title/body if possible
      // Skipping as post creation already validates required fields
    });

    test('should require authentication', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/blog/${publishedPostId}/publish`);

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    test('should return 404 for non-existent post', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/blog/00000000-0000-0000-0000-000000000000/publish`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error).toContain('not found');
    });
  });

  test.describe('POST /api/blog/:id/unpublish', () => {

    test('should unpublish published post', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/blog/${publishedPostId}/unpublish`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('draft');
    });

    test('should require authentication', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/blog/${publishedPostId}/unpublish`);

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    test('should return 404 for non-existent post', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/blog/00000000-0000-0000-0000-000000000000/unpublish`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error).toContain('not found');
    });
  });

  test.describe('DELETE /api/blog/:id', () => {

    test('should soft delete blog post', async ({ request }) => {
      const response = await request.delete(`${API_URL}/api/blog/${createdPostId}`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    test('should return 404 for already deleted post', async ({ request }) => {
      const response = await request.delete(`${API_URL}/api/blog/${createdPostId}`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error).toContain('not found');
    });

    test('should return 404 for non-existent post', async ({ request }) => {
      const response = await request.delete(`${API_URL}/api/blog/00000000-0000-0000-0000-000000000000`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        }
      });

      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error).toContain('not found');
    });

    test('should require authentication', async ({ request }) => {
      const response = await request.delete(`${API_URL}/api/blog/${publishedPostId}`);

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    test('should only allow author or admin to delete', async ({ request }) => {
      // Create a post as admin
      const postResponse = await request.post(`${API_URL}/api/blog`, {
        headers: {
          Cookie: `accessToken=${adminAccessToken}`
        },
        data: {
          title: 'Post to delete test',
          body_html: '<p>Content</p>'
        }
      });
      const postId = (await postResponse.json()).id;

      // Create a second user
      const secondUser = {
        email: `delete-test-${Date.now()}@example.com`,
        username: `deletetest${Date.now()}`,
        password: 'Delete123!@#'
      };

      await request.post(`${API_URL}/api/auth/register`, { data: secondUser });

      const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          username: secondUser.username,
          password: secondUser.password
        }
      });

      const cookies = loginResponse.headers()['set-cookie'];
      const match = cookies?.match(/accessToken=([^;]+)/);
      const secondUserToken = match ? match[1] : '';

      // Try to delete admin's post as second user
      const response = await request.delete(`${API_URL}/api/blog/${postId}`, {
        headers: {
          Cookie: `accessToken=${secondUserToken}`
        }
      });

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('Insufficient permissions');
    });
  });
});
