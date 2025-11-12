import { test, expect } from '@playwright/test';

/**
 * Complete Taxonomy Workflow Test
 *
 * This test verifies the entire taxonomy system workflow:
 * 1. Create vocabularies (categories and tags)
 * 2. Add terms to vocabularies
 * 3. Create a blog post with taxonomy associations
 * 4. Verify the associations are saved correctly
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';

test.describe('Complete Taxonomy Workflow', () => {
  let accessToken: string;
  let categoriesVocabId: string;
  let tagsVocabId: string;
  let techCategoryId: string;
  let tutorialCategoryId: string;
  let jsTagId: string;
  let reactTagId: string;
  let blogPostId: string;

  test.beforeAll(async ({ request }) => {
    // Login to get auth token
    const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        username: 'kevin',
        password: '(130Bpm)',
      },
    });

    const cookies = loginResponse.headers()['set-cookie'];
    const match = cookies?.match(/accessToken=([^;]+)/);
    accessToken = match ? match[1] : '';
    expect(accessToken).toBeTruthy();
  });

  test('should create categories vocabulary', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/taxonomy/vocabularies`, {
      headers: { Cookie: `accessToken=${accessToken}` },
      data: {
        name: 'Categories',
        machine_name: 'categories',
        description: 'Blog post categories',
        allow_multiple: true,
        required: false,
        hierarchy_depth: 2,
        weight: 0,
      },
    });

    // May already exist, accept either 201 or 409 (conflict)
    expect([201, 409].includes(response.status())).toBeTruthy();

    if (response.status() === 201) {
      const data = await response.json();
      categoriesVocabId = data.vocabulary.id;
    } else {
      // Get existing vocabulary
      const getResponse = await request.get(`${API_URL}/api/taxonomy/vocabularies/machine-name/categories`, {
        headers: { Cookie: `accessToken=${accessToken}` },
      });
      const data = await getResponse.json();
      categoriesVocabId = data.vocabulary.id;
    }
  });

  test('should create tags vocabulary', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/taxonomy/vocabularies`, {
      headers: { Cookie: `accessToken=${accessToken}` },
      data: {
        name: 'Tags',
        machine_name: 'tags',
        description: 'Blog post tags',
        allow_multiple: true,
        required: false,
        hierarchy_depth: 0,
        weight: 1,
      },
    });

    expect([201, 409].includes(response.status())).toBeTruthy();

    if (response.status() === 201) {
      const data = await response.json();
      tagsVocabId = data.vocabulary.id;
    } else {
      const getResponse = await request.get(`${API_URL}/api/taxonomy/vocabularies/machine-name/tags`, {
        headers: { Cookie: `accessToken=${accessToken}` },
      });
      const data = await getResponse.json();
      tagsVocabId = data.vocabulary.id;
    }
  });

  test('should create category terms', async ({ request }) => {
    // Create "Technology" category
    const techResponse = await request.post(`${API_URL}/api/taxonomy/terms`, {
      headers: { Cookie: `accessToken=${accessToken}` },
      data: {
        vocabulary_id: categoriesVocabId,
        name: 'Technology',
        slug: 'technology',
        description: 'Technology related posts',
        weight: 0,
      },
    });

    expect(techResponse.status()).toBe(201);
    const techData = await techResponse.json();
    techCategoryId = techData.term.id;

    // Create "Tutorial" category
    const tutorialResponse = await request.post(`${API_URL}/api/taxonomy/terms`, {
      headers: { Cookie: `accessToken=${accessToken}` },
      data: {
        vocabulary_id: categoriesVocabId,
        name: 'Tutorial',
        slug: 'tutorial',
        description: 'Tutorial and how-to posts',
        weight: 1,
      },
    });

    expect(tutorialResponse.status()).toBe(201);
    const tutorialData = await tutorialResponse.json();
    tutorialCategoryId = tutorialData.term.id;
  });

  test('should create tag terms', async ({ request }) => {
    // Create "JavaScript" tag
    const jsResponse = await request.post(`${API_URL}/api/taxonomy/terms`, {
      headers: { Cookie: `accessToken=${accessToken}` },
      data: {
        vocabulary_id: tagsVocabId,
        name: 'JavaScript',
        slug: 'javascript',
        description: 'JavaScript programming language',
        weight: 0,
      },
    });

    expect(jsResponse.status()).toBe(201);
    const jsData = await jsResponse.json();
    jsTagId = jsData.term.id;

    // Create "React" tag
    const reactResponse = await request.post(`${API_URL}/api/taxonomy/terms`, {
      headers: { Cookie: `accessToken=${accessToken}` },
      data: {
        vocabulary_id: tagsVocabId,
        name: 'React',
        slug: 'react',
        description: 'React JavaScript library',
        weight: 1,
      },
    });

    expect(reactResponse.status()).toBe(201);
    const reactData = await reactResponse.json();
    reactTagId = reactData.term.id;
  });

  test('should create blog post', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/blog`, {
      headers: { Cookie: `accessToken=${accessToken}` },
      data: {
        title: `Taxonomy Test Post ${Date.now()}`,
        body_html: '<p>This is a test post to verify taxonomy integration.</p>',
        excerpt: 'Test post for taxonomy',
        status: 'published',
        allow_comments: true,
      },
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    blogPostId = data.id;
  });

  test('should associate categories with blog post', async ({ request }) => {
    // Associate Technology category
    const techResponse = await request.post(
      `${API_URL}/api/taxonomy/entities/blog_post/${blogPostId}/terms/${techCategoryId}`,
      {
        headers: { Cookie: `accessToken=${accessToken}` },
      }
    );
    expect(techResponse.status()).toBe(201);

    // Associate Tutorial category
    const tutorialResponse = await request.post(
      `${API_URL}/api/taxonomy/entities/blog_post/${blogPostId}/terms/${tutorialCategoryId}`,
      {
        headers: { Cookie: `accessToken=${accessToken}` },
      }
    );
    expect(tutorialResponse.status()).toBe(201);
  });

  test('should associate tags with blog post', async ({ request }) => {
    // Associate JavaScript tag
    const jsResponse = await request.post(
      `${API_URL}/api/taxonomy/entities/blog_post/${blogPostId}/terms/${jsTagId}`,
      {
        headers: { Cookie: `accessToken=${accessToken}` },
      }
    );
    expect(jsResponse.status()).toBe(201);

    // Associate React tag
    const reactResponse = await request.post(
      `${API_URL}/api/taxonomy/entities/blog_post/${blogPostId}/terms/${reactTagId}`,
      {
        headers: { Cookie: `accessToken=${accessToken}` },
      }
    );
    expect(reactResponse.status()).toBe(201);
  });

  test('should retrieve blog post with taxonomy terms', async ({ request }) => {
    const response = await request.get(
      `${API_URL}/api/taxonomy/entities/blog_post/${blogPostId}/terms`,
      {
        headers: { Cookie: `accessToken=${accessToken}` },
      }
    );

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.terms).toBeDefined();
    expect(Array.isArray(data.terms)).toBeTruthy();
    expect(data.terms.length).toBe(4); // 2 categories + 2 tags

    // Verify all expected terms are present
    const termNames = data.terms.map((t: any) => t.name);
    expect(termNames).toContain('Technology');
    expect(termNames).toContain('Tutorial');
    expect(termNames).toContain('JavaScript');
    expect(termNames).toContain('React');

  });

  test('should list entities by term', async ({ request }) => {
    const response = await request.get(
      `${API_URL}/api/taxonomy/entities/blog_post/by-term/${techCategoryId}`,
      {
        headers: { Cookie: `accessToken=${accessToken}` },
      }
    );

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.entity_ids).toBeDefined();
    expect(Array.isArray(data.entity_ids)).toBeTruthy();
    expect(data.entity_ids).toContain(blogPostId);

  });

  test('should remove taxonomy association', async ({ request }) => {
    const response = await request.delete(
      `${API_URL}/api/taxonomy/entities/blog_post/${blogPostId}/terms/${reactTagId}`,
      {
        headers: { Cookie: `accessToken=${accessToken}` },
      }
    );

    expect(response.ok()).toBeTruthy();

    // Verify removal
    const getResponse = await request.get(
      `${API_URL}/api/taxonomy/entities/blog_post/${blogPostId}/terms`,
      {
        headers: { Cookie: `accessToken=${accessToken}` },
      }
    );

    const data = await getResponse.json();
    expect(data.terms.length).toBe(3); // Should have 3 terms left
    const termNames = data.terms.map((t: any) => t.name);
    expect(termNames).not.toContain('React');
  });
});
