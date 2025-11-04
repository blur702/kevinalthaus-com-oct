import { test, expect } from '@playwright/test';
import { login, TEST_CREDENTIALS, apiRequest } from './utils/auth';

/**
 * Blog Post Tests
 *
 * Test suite covering blog post creation, editing, publishing, and viewing.
 * Validates the blog plugin functionality end-to-end.
 */

test.describe('Blog Post Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin before each test
    await login(
      page,
      TEST_CREDENTIALS.ADMIN.username,
      TEST_CREDENTIALS.ADMIN.password
    );
  });

  test('should create and publish a blog post about dogs', async ({ page }) => {
    // Navigate to blog management (update this URL when frontend route is known)
    // For now, we'll use API directly to test backend functionality

    // Create a blog post via API using page.context() to preserve cookies
    const createResponse = await apiRequest(page, '/api/blog', {
      data: {
        title: 'Everything You Need to Know About Dogs',
        body_html: `
          <h2>Man's Best Friend</h2>
          <p>Dogs have been companions to humans for thousands of years. They are loyal, loving, and make wonderful pets for families and individuals alike.</p>

          <h3>Popular Dog Breeds</h3>
          <ul>
            <li><strong>Golden Retriever</strong>: Known for their friendly and gentle temperament</li>
            <li><strong>German Shepherd</strong>: Intelligent and versatile working dogs</li>
            <li><strong>Labrador Retriever</strong>: America's most popular breed, great with families</li>
            <li><strong>Beagle</strong>: Small, friendly, and great with children</li>
          </ul>

          <h3>Caring for Your Dog</h3>
          <p>Proper dog care includes regular exercise, a balanced diet, routine veterinary check-ups, and lots of love and attention. Dogs need mental stimulation as well as physical activity to stay healthy and happy.</p>

          <h3>Training Tips</h3>
          <p>Start training your dog early using positive reinforcement techniques. Consistency is key, and patience will help your dog learn commands and good behavior. Socialization with other dogs and people is also important for a well-adjusted pet.</p>

          <h3>Health Considerations</h3>
          <p>Keep your dog up to date on vaccinations, provide flea and tick prevention, and maintain dental hygiene. Watch for signs of illness and don't hesitate to contact your veterinarian if you notice any concerning symptoms.</p>
        `,
        excerpt: 'A comprehensive guide to understanding, caring for, and training your canine companion.',
        meta_description: 'Learn everything about dogs - from popular breeds to care tips, training advice, and health considerations for your furry friend.',
        meta_keywords: ['dogs', 'dog care', 'dog breeds', 'pet care', 'dog training'],
        reading_time_minutes: 5,
        allow_comments: true,
        status: 'draft',
      },
    });

    expect(createResponse.ok()).toBeTruthy();
    const createdPost = await createResponse.json();
    expect(createdPost).toHaveProperty('id');
    expect(createdPost.title).toBe('Everything You Need to Know About Dogs');
    expect(createdPost.status).toBe('draft');

    // Verify post was created
    const postId = createdPost.id;

    // Get the draft post to verify it exists
    const getResponse = await apiRequest(page, `/api/blog/${postId}`);
    expect(getResponse.ok()).toBeTruthy();
    const draftPost = await getResponse.json();
    expect(draftPost.title).toBe('Everything You Need to Know About Dogs');
    expect(draftPost.status).toBe('draft');

    // Publish the post
    const publishResponse = await apiRequest(page, `/api/blog/${postId}/publish`, {
      data: {},
    });
    expect(publishResponse.ok()).toBeTruthy();
    const publishedPost = await publishResponse.json();
    expect(publishedPost.status).toBe('published');
    expect(publishedPost.published_at).toBeTruthy();

    // Verify published post appears in public endpoint
    const publicResponse = await apiRequest(page, '/api/blog/public?page=1&limit=10');
    expect(publicResponse.ok()).toBeTruthy();
    const publicData = await publicResponse.json();
    expect(publicData.posts).toBeInstanceOf(Array);

    // Find our published post in the list
    const foundPost = publicData.posts.find((p: { id: string }) => p.id === postId);
    expect(foundPost).toBeTruthy();
    expect(foundPost.title).toBe('Everything You Need to Know About Dogs');
    expect(foundPost.status).toBe('published');
  });

  test('should create a draft blog post and verify it is not public', async ({ page }) => {
    // Create a draft blog post
    const createResponse = await apiRequest(page, '/api/blog', {
      data: {
        title: 'Understanding Dog Behavior (Draft)',
        body_html: '<p>This is a draft post about dog behavior that should not be publicly visible.</p>',
        excerpt: 'A draft article about understanding your dog.',
        status: 'draft',
      },
    });

    expect(createResponse.ok()).toBeTruthy();
    const createdPost = await createResponse.json();
    const postId = createdPost.id;

    // Verify draft post does NOT appear in public endpoint
    const publicResponse = await apiRequest(page, '/api/blog/public?page=1&limit=10');
    expect(publicResponse.ok()).toBeTruthy();
    const publicData = await publicResponse.json();

    const foundPost = publicData.posts.find((p: { id: string }) => p.id === postId);
    expect(foundPost).toBeUndefined();

    // Verify authenticated user CAN see it in admin endpoint
    const adminResponse = await apiRequest(page, `/api/blog/${postId}`);
    expect(adminResponse.ok()).toBeTruthy();
    const draftPost = await adminResponse.json();
    expect(draftPost.status).toBe('draft');
  });

  test('should update a blog post', async ({ page }) => {
    // Create a blog post
    const createResponse = await apiRequest(page, '/api/blog', {
      data: {
        title: 'Dog Training Basics',
        body_html: '<p>Initial content about dog training.</p>',
        status: 'draft',
      },
    });

    expect(createResponse.ok()).toBeTruthy();
    const createdPost = await createResponse.json();
    const postId = createdPost.id;

    // Update the post
    const updateResponse = await apiRequest(page, `/api/blog/${postId}`, {
      data: {
        title: 'Advanced Dog Training Techniques',
        body_html: '<p>Updated content with advanced training methods.</p>',
        reading_time_minutes: 10,
      },
    });

    expect(updateResponse.ok()).toBeTruthy();
    const updatedPost = await updateResponse.json();
    expect(updatedPost.title).toBe('Advanced Dog Training Techniques');
    expect(updatedPost.reading_time_minutes).toBe(10);

    // Verify update persisted
    const getResponse = await apiRequest(page, `/api/blog/${postId}`);
    expect(getResponse.ok()).toBeTruthy();
    const fetchedPost = await getResponse.json();
    expect(fetchedPost.title).toBe('Advanced Dog Training Techniques');
  });

  test('should unpublish a published blog post', async ({ page }) => {
    // Create and publish a post
    const createResponse = await apiRequest(page, '/api/blog', {
      data: {
        title: 'Dog Health Tips',
        body_html: '<p>Important health tips for dog owners.</p>',
        status: 'draft',
      },
    });

    expect(createResponse.ok()).toBeTruthy();
    const createdPost = await createResponse.json();
    const postId = createdPost.id;

    // Publish it
    await page.context().request.post(`/api/blog/${postId}/publish`, { data: {} });

    // Verify it's in public endpoint
    let publicResponse = await apiRequest(page, '/api/blog/public?page=1&limit=10');
    let publicData = await publicResponse.json();
    let foundPost = publicData.posts.find((p: { id: string }) => p.id === postId);
    expect(foundPost).toBeTruthy();

    // Unpublish it
    const unpublishResponse = await page.context().request.post(`/api/blog/${postId}/unpublish`, { data: {} });
    expect(unpublishResponse.ok()).toBeTruthy();
    const unpublishedPost = await unpublishResponse.json();
    expect(unpublishedPost.status).toBe('draft');

    // Verify it's no longer in public endpoint
    publicResponse = await apiRequest(page, '/api/blog/public?page=1&limit=10');
    publicData = await publicResponse.json();
    foundPost = publicData.posts.find((p: { id: string }) => p.id === postId);
    expect(foundPost).toBeUndefined();
  });

  test('should soft delete a blog post', async ({ page }) => {
    // Create a blog post
    const createResponse = await apiRequest(page, '/api/blog', {
      data: {
        title: 'Dog Nutrition Guide',
        body_html: '<p>A guide to proper dog nutrition.</p>',
        status: 'draft',
      },
    });

    expect(createResponse.ok()).toBeTruthy();
    const createdPost = await createResponse.json();
    const postId = createdPost.id;

    // Delete the post
    const deleteResponse = await apiRequest(page, `/api/blog/${postId}`);
    expect(deleteResponse.ok()).toBeTruthy();

    // Verify post is no longer accessible
    const getResponse = await apiRequest(page, `/api/blog/${postId}`);
    expect(getResponse.status()).toBe(404);
  });

  test('should list blog posts with pagination', async ({ page }) => {
    // Create multiple blog posts
    const titles = [
      'Dog Breeds Guide',
      'Puppy Training 101',
      'Senior Dog Care',
    ];

    for (const title of titles) {
      const createResponse = await apiRequest(page, '/api/blog', {
        data: {
          title,
          body_html: `<p>Content for ${title}</p>`,
          status: 'draft',
        },
      });
    }

    // List posts with pagination
    const listResponse = await apiRequest(page, '/api/blog?page=1&limit=2');
    expect(listResponse.ok()).toBeTruthy();
    const listData = await listResponse.json();

    expect(listData.posts).toBeInstanceOf(Array);
    expect(listData.posts.length).toBeLessThanOrEqual(2);
    expect(listData).toHaveProperty('total');
    expect(listData).toHaveProperty('page', 1);
    expect(listData).toHaveProperty('limit', 2);
    expect(listData).toHaveProperty('total_pages');
  });
});
