import { test, expect } from '@playwright/test';
import { login, TEST_CREDENTIALS } from './utils/auth';

/**
 * Taxonomy Workflow Test
 *
 * Tests the complete taxonomy workflow:
 * 1. Login to the admin panel
 * 2. Create a new taxonomy category
 * 3. Create content about cats
 * 4. Assign the taxonomy category to the content
 * 5. Verify the assignment
 */

test.describe('Taxonomy Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);
  });

  test('should create category, create content about cats, and assign taxonomy', async ({ page }) => {
    // Step 1: Create a new category "Animals"
    await test.step('Create Animals category', async () => {
      // Navigate to taxonomy/categories page
      await page.goto('/taxonomy/categories');

      // Wait for page to load
      await page.waitForSelector('h1:has-text("Categories")', { timeout: 5000 });

      // Click "Create Category" button
      await page.click('button:has-text("Create Category"), button:has-text("New Category"), button:has-text("Add Category")');

      // Fill in category details
      await page.fill('input[name="name"], input[placeholder*="name" i]', 'Animals');
      await page.fill('textarea[name="description"], textarea[placeholder*="description" i]', 'Category for animal-related content');

      // Submit the form
      await page.click('button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Save")');

      // Wait for success message or redirect
      await page.waitForTimeout(1000);

      // Verify category appears in the list
      await expect(page.locator('text=Animals')).toBeVisible({ timeout: 5000 });
    });

    // Step 2: Create content about cats
    let contentId: string;
    await test.step('Create content about cats', async () => {
      // Navigate to content creation page
      await page.goto('/content/new');

      // Wait for editor to load
      await page.waitForSelector('input[name="title"], input[placeholder*="title" i]', { timeout: 5000 });

      // Fill in content details
      await page.fill('input[name="title"], input[placeholder*="title" i]', 'Amazing Facts About Cats');

      // Fill in slug (if auto-generated, this might be readonly)
      const slugInput = page.locator('input[name="slug"]');
      const isReadonly = await slugInput.getAttribute('readonly');
      if (!isReadonly) {
        await page.fill('input[name="slug"]', 'amazing-facts-about-cats');
      }

      // Fill in the main content (look for TinyMCE editor or textarea)
      const editorFrame = page.frameLocator('iframe[id*="mce"], iframe.tox-edit-area__iframe');
      const hasEditor = await editorFrame.locator('body').count() > 0;

      if (hasEditor) {
        // TinyMCE editor
        await editorFrame.locator('body').click();
        await editorFrame.locator('body').fill(`
# Why Cats Are Amazing

Cats are fascinating creatures that have captivated humans for thousands of years. Here are some incredible facts about cats:

## Independence
Cats are known for their independent nature. Unlike dogs, they don't require constant attention and can entertain themselves.

## Hunting Skills
Even domesticated cats retain their hunting instincts. They can spot the tiniest movement and pounce with incredible precision.

## Communication
Cats communicate through various means including meowing, purring, body language, and scent marking.

## Sleep Patterns
Cats sleep an average of 12-16 hours per day, conserving energy for hunting (or playing with toys).

## Agility
Cats are incredibly agile and can jump up to six times their length. Their flexible spine allows them to twist and turn mid-air.
        `.trim());
      } else {
        // Fallback to textarea
        await page.fill('textarea[name="body"], textarea[name="content"]', `
# Why Cats Are Amazing

Cats are fascinating creatures that have captivated humans for thousands of years.

## Independence
Cats are known for their independent nature.

## Hunting Skills
Even domesticated cats retain their hunting instincts.

## Communication
Cats communicate through meowing, purring, and body language.
        `.trim());
      }

      // Fill in meta description
      const metaDescInput = page.locator('input[name="meta_description"], textarea[name="meta_description"]');
      if (await metaDescInput.count() > 0) {
        await metaDescInput.fill('Discover amazing facts about cats, including their hunting skills, communication methods, and unique behaviors.');
      }

      // Save as draft first (don't publish yet, so we can add taxonomy)
      const saveDraftButton = page.locator('button:has-text("Save Draft"), button:has-text("Save as Draft")');
      if (await saveDraftButton.count() > 0) {
        await saveDraftButton.click();
      } else {
        // If no draft button, just submit
        await page.click('button[type="submit"]:has-text("Save"), button[type="submit"]:has-text("Create")');
      }

      // Wait for success message or redirect
      await page.waitForTimeout(2000);

      // Extract content ID from URL (e.g., /content/edit/abc-123)
      const url = page.url();
      const idMatch = url.match(/\/content\/(?:edit\/)?([a-f0-9-]+)/);
      if (idMatch) {
        contentId = idMatch[1];
      }

      // Verify content was created
      await expect(page.locator('text=Amazing Facts About Cats')).toBeVisible({ timeout: 5000 });
    });

    // Step 3: Assign taxonomy to the content
    await test.step('Assign Animals category to content', async () => {
      // If we're not already on the edit page, navigate there
      if (contentId && !page.url().includes('/edit/')) {
        await page.goto(`/content/edit/${contentId}`);
      }

      // Look for taxonomy/category section
      const categorySection = page.locator('text=Categories, text=Taxonomy, [data-testid="categories-section"]').first();
      if (await categorySection.count() > 0) {
        await categorySection.scrollIntoViewIfNeeded();
      }

      // Find and click the Animals category checkbox/button
      // This could be a checkbox, multi-select dropdown, or chips
      const animalsCategoryOption = page.locator('[type="checkbox"][value*="animals" i], label:has-text("Animals"), button:has-text("Animals")').first();

      if (await animalsCategoryOption.count() > 0) {
        await animalsCategoryOption.click();
      } else {
        // Try finding in a dropdown
        const categoryDropdown = page.locator('select[name="categories"], [role="combobox"]');
        if (await categoryDropdown.count() > 0) {
          await categoryDropdown.click();
          await page.click('text=Animals');
        }
      }

      // Save the changes
      await page.click('button[type="submit"]:has-text("Save"), button[type="submit"]:has-text("Update")');

      // Wait for save to complete
      await page.waitForTimeout(1000);

      // Verify success message or that we're still on the edit page
      const successMessage = page.locator('text=saved, text=updated, [role="alert"]:has-text("Success")');
      if (await successMessage.count() > 0) {
        await expect(successMessage).toBeVisible({ timeout: 5000 });
      }
    });

    // Step 4: Verify the taxonomy assignment
    await test.step('Verify taxonomy assignment', async () => {
      // Reload the page to ensure data is persisted
      await page.reload();

      // Wait for page to load
      await page.waitForTimeout(1000);

      // Verify the Animals category is selected/assigned
      const assignedCategory = page.locator('text=Animals, [data-selected="true"]:has-text("Animals"), input:checked + label:has-text("Animals")');
      await expect(assignedCategory.first()).toBeVisible({ timeout: 5000 });

      // Additional verification: Check if the category appears in the content list
      await page.goto('/content');

      // Filter by Animals category (if filtering is available)
      const categoryFilter = page.locator('select[name="category"], [data-testid="category-filter"]');
      if (await categoryFilter.count() > 0) {
        await categoryFilter.selectOption({ label: 'Animals' });
        await page.waitForTimeout(500);

        // Verify our cat content appears in filtered results
        await expect(page.locator('text=Amazing Facts About Cats')).toBeVisible({ timeout: 5000 });
      }
    });

    // Cleanup: Delete the test content and category
    await test.step('Cleanup test data', async () => {
      // Delete the content
      if (contentId) {
        await page.goto(`/content/edit/${contentId}`);
        const deleteButton = page.locator('button:has-text("Delete")');
        if (await deleteButton.count() > 0) {
          await deleteButton.click();

          // Confirm deletion if there's a confirmation dialog
          const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete"):visible');
          if (await confirmButton.count() > 0) {
            await confirmButton.click();
          }

          await page.waitForTimeout(1000);
        }
      }

      // Delete the category
      await page.goto('/taxonomy/categories');
      const animalsRow = page.locator('tr:has-text("Animals"), [data-testid="category-Animals"]');
      if (await animalsRow.count() > 0) {
        const deleteButton = animalsRow.locator('button:has-text("Delete"), [aria-label="Delete"]');
        if (await deleteButton.count() > 0) {
          await deleteButton.click();

          // Confirm deletion
          const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete"):visible');
          if (await confirmButton.count() > 0) {
            await confirmButton.click();
          }
        }
      }
    });
  });
});
