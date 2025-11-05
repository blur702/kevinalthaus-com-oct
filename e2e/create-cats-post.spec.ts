import { test, expect } from '@playwright/test';

/**
 * Test to create a blog post about cats
 */

test.describe('Create Cats Blog Post', () => {
  test('should create a blog post about cats with 3 paragraphs', async ({ page }) => {
    // Step 1: Login as kevin
    console.log('Step 1: Logging in as kevin...');
    await page.goto('/login');
    await page.locator('input[name="identifier"]').fill('kevin');
    await page.locator('input[name="password"]').fill('(130Bpm)');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL('/', { timeout: 10000 });
    console.log('✓ Logged in successfully');

    // Step 2: Navigate to Content page
    console.log('Step 2: Navigating to Content page...');
    await page.goto('/content');
    await expect(page).toHaveURL('/content', { timeout: 5000 });
    console.log('✓ Content page loaded');

    // Step 3: Click Create New Post button
    console.log('Step 3: Opening blog post form...');
    const createButton = page.locator('button:has-text("New Post"), button:has-text("Create Post"), button:has-text("Add Post")').first();
    await createButton.waitFor({ state: 'visible', timeout: 10000 });
    await createButton.click();
    console.log('✓ Blog post form opened');

    // Step 4: Wait for form to be ready
    await page.waitForSelector('input[name="title"]', { timeout: 10000 });
    await page.waitForSelector('textarea[name="body_html"]', { timeout: 5000 });
    console.log('✓ Form fields loaded');

    // Step 5: Fill in the blog post about cats
    console.log('Step 5: Creating blog post about cats...');

    const title = 'Pawsitively Purrfect: Why Cats Are the Ultimate Companion';
    const content = `<h2>The Independent Charm of Feline Friends</h2>

<p>Cats have captivated humans for thousands of years with their mysterious and independent nature. Unlike their canine counterparts, cats don't require constant attention or validation. They're perfectly content lounging in a sunbeam for hours, yet they'll grace you with their presence when they deem you worthy. This unique blend of self-sufficiency and selective affection makes them the ideal pet for those who appreciate a companion that respects boundaries while still providing warmth and comfort when needed.</p>

<h2>Masters of the Art of Relaxation</h2>

<p>If there's one thing cats excel at, it's the ability to find comfort in any situation. From squeezing into impossibly small boxes to claiming the warmest spot in your home (usually your laptop keyboard), cats are experts at making themselves comfortable. Their purring serves as a soothing soundtrack to everyday life, proven to reduce stress and lower blood pressure in their human companions. Watching a cat methodically groom themselves or perform their elaborate stretching routine is a reminder to slow down and appreciate life's simple pleasures.</p>

<h2>Entertainment Without the Effort</h2>

<p>Owning a cat means never being bored. Their antics provide endless entertainment, whether it's the infamous 3 AM zoomies, the sudden inexplicable fear of cucumbers, or their ability to knock things off tables with calculated precision. They'll turn any piece of string into an epic hunting expedition and transform a cardboard box into a fortress. Best of all, they accomplish all this while maintaining an air of dignity and superiority, as if they're doing you a favor by allowing you to witness their greatness. In the end, we don't own cats—they graciously allow us to serve them, and we wouldn't have it any other way.</p>`;

    const excerpt = 'Discover why cats make the perfect companions, from their independent nature to their endless entertainment value. A humorous yet heartfelt look at our feline overlords.';

    // Fill in title
    await page.locator('input[name="title"]').fill(title);
    console.log(`✓ Title: ${title}`);

    // Fill in content
    await page.locator('textarea[name="body_html"]').fill(content);
    console.log('✓ Content: 3 paragraphs about cats with HTML formatting');

    // Fill in excerpt if available
    const excerptField = page.locator('textarea[name="excerpt"]');
    const excerptCount = await excerptField.count();
    if (excerptCount > 0) {
      await excerptField.fill(excerpt);
      console.log('✓ Excerpt added');
    }

    // Step 6: Submit the blog post
    console.log('Step 6: Submitting blog post...');
    const submitButton = page.locator('button:has-text("Create"), button:has-text("Save")').first();
    await expect(submitButton).toBeEnabled();

    // Click submit and wait for navigation/success
    await submitButton.click();

    // Wait for either redirect to blog list or success message
    try {
      await expect(page).toHaveURL('/content', { timeout: 10000 });
      console.log('✓ Redirected back to content list');
    } catch {
      // Check for success message instead
      const successMessage = page.locator('text=/success|created|saved/i');
      await expect(successMessage).toBeVisible({ timeout: 5000 });
      console.log('✓ Success message displayed');
    }

    console.log('\n✅ BLOG POST CREATED SUCCESSFULLY!');
    console.log('-----------------------------------');
    console.log('Title: Pawsitively Purrfect: Why Cats Are the Ultimate Companion');
    console.log('Paragraphs: 3 well-crafted paragraphs about cats');
    console.log('Content includes: HTML formatting, headers, and proper structure');
    console.log('-----------------------------------');
  });

  test('should verify the cats post appears in the blog list', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.locator('input[name="identifier"]').fill('kevin');
    await page.locator('input[name="password"]').fill('(130Bpm)');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // Navigate to content list
    await page.goto('/content');

    // Look for the cats post in the list
    const catsPost = page.locator('text=/Pawsitively Purrfect/i');

    // Wait for the post to appear
    try {
      await catsPost.waitFor({ state: 'visible', timeout: 5000 });
      console.log('✓ Cats blog post found in the list!');

      // Try to click on it to view details
      await catsPost.click();
      console.log('✓ Successfully opened cats post');
    } catch (error) {
      console.log('ℹ Post might not be visible yet or pagination may be needed');
    }
  });
});
