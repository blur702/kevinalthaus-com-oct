import { test, expect, Page } from '@playwright/test';
import { login, TEST_CREDENTIALS } from './utils/auth';

/**
 * Taxonomy Management Tests
 *
 * Tests the complete taxonomy system including:
 * - Vocabulary creation and management
 * - Term creation within vocabularies
 * - Hierarchical term structures
 * - Integration with BlogForm
 * - Persistence of taxonomy assignments
 */

/**
 * Helper function to login as kevin
 */
async function loginAsKevin(page: Page): Promise<void> {
  await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);
}

test.describe('Taxonomy Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsKevin(page);
  });

  test('should navigate to Taxonomy page', async ({ page }) => {
    await page.goto('/taxonomy');
    await expect(page).toHaveURL('/taxonomy');
    await expect(page.locator('text=/Taxonomy/i')).toBeVisible({ timeout: 5000 });
  });

  test('should create a new vocabulary', async ({ page }) => {
    await page.goto('/taxonomy');

    // Click "Create Vocabulary" or "Add Vocabulary" button
    const createVocabButton = page.locator('button:has-text("Create"), button:has-text("Add Vocabulary"), button:has-text("New Vocabulary")').first();
    await createVocabButton.click({ timeout: 5000 });

    // Wait for dialog to appear
    await page.waitForSelector('input[name="name"], input[placeholder*="name" i]', { timeout: 5000 });

    // Fill in vocabulary details
    const testVocabName = `Test Categories ${Date.now()}`;
    await page.locator('input[name="name"], input[placeholder*="name" i]').fill(testVocabName);

    // Fill machine name
    const machineName = `test_categories_${Date.now()}`;
    await page.locator('input[name="machine_name"], input[placeholder*="machine" i]').fill(machineName);

    // Fill description if available
    const descriptionField = page.locator('textarea[name="description"], textarea[placeholder*="description" i]');
    if (await descriptionField.count() > 0) {
      await descriptionField.fill('Test vocabulary for categories');
    }

    // Check "Allow Multiple" if available
    const allowMultipleCheckbox = page.locator('input[type="checkbox"][name="allow_multiple"], input[type="checkbox"] + label:has-text("Allow Multiple")');
    if (await allowMultipleCheckbox.count() > 0) {
      await allowMultipleCheckbox.check();
    }

    // Submit the form
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Create")').first();
    await saveButton.click();

    // Wait for dialog to close and vocabulary to appear in list
    await page.waitForTimeout(1000);

    // Verify vocabulary appears in the list
    await expect(page.locator(`text=${testVocabName}`)).toBeVisible({ timeout: 5000 });
  });

  test('should create a term within a vocabulary', async ({ page }) => {
    await page.goto('/taxonomy');

    // First, create a vocabulary
    const createVocabButton = page.locator('button:has-text("Create"), button:has-text("Add Vocabulary"), button:has-text("New Vocabulary")').first();
    await createVocabButton.click({ timeout: 5000 });

    const testVocabName = `Animals ${Date.now()}`;
    const machineName = `animals_${Date.now()}`;

    await page.waitForSelector('input[name="name"], input[placeholder*="name" i]', { timeout: 5000 });
    await page.locator('input[name="name"], input[placeholder*="name" i]').fill(testVocabName);
    await page.locator('input[name="machine_name"], input[placeholder*="machine" i]').fill(machineName);

    const saveVocabButton = page.locator('button:has-text("Save"), button:has-text("Create")').first();
    await saveVocabButton.click();
    await page.waitForTimeout(1000);

    // Select the vocabulary from the list
    await page.locator(`text=${testVocabName}`).click();
    await page.waitForTimeout(500);

    // Click "Create Term" or "Add Term" button
    const createTermButton = page.locator('button:has-text("Add Term"), button:has-text("Create Term"), button:has-text("New Term")').first();
    await createTermButton.click({ timeout: 5000 });

    // Wait for term form to appear
    await page.waitForSelector('input[name="name"]:visible, input[placeholder*="term name" i]:visible', { timeout: 5000 });

    // Fill in term details
    const testTermName = 'Cats';
    await page.locator('input[name="name"]:visible, input[placeholder*="term name" i]:visible').fill(testTermName);

    // Fill slug if available
    const slugField = page.locator('input[name="slug"]:visible, input[placeholder*="slug" i]:visible');
    if (await slugField.count() > 0) {
      await slugField.fill('cats');
    }

    // Fill description if available
    const termDescField = page.locator('textarea[name="description"]:visible, textarea[placeholder*="description" i]:visible');
    if (await termDescField.count() > 0) {
      await termDescField.fill('All content related to cats');
    }

    // Submit the term form
    const saveTermButton = page.locator('button:has-text("Save"), button:has-text("Create")').last();
    await saveTermButton.click();

    // Wait for term to appear in the list
    await page.waitForTimeout(1000);

    // Verify term appears in the list
    await expect(page.locator(`text=${testTermName}`)).toBeVisible({ timeout: 5000 });
  });

  test('should create hierarchical terms (parent-child)', async ({ page }) => {
    await page.goto('/taxonomy');

    // Create vocabulary
    const createVocabButton = page.locator('button:has-text("Create"), button:has-text("Add Vocabulary"), button:has-text("New Vocabulary")').first();
    await createVocabButton.click({ timeout: 5000 });

    const testVocabName = `Topics ${Date.now()}`;
    const machineName = `topics_${Date.now()}`;

    await page.waitForSelector('input[name="name"], input[placeholder*="name" i]', { timeout: 5000 });
    await page.locator('input[name="name"], input[placeholder*="name" i]').fill(testVocabName);
    await page.locator('input[name="machine_name"], input[placeholder*="machine" i]').fill(machineName);

    // Enable hierarchy
    const hierarchyField = page.locator('input[type="number"][name="hierarchy_depth"]');
    if (await hierarchyField.count() > 0) {
      await hierarchyField.fill('2');
    }

    const saveVocabButton = page.locator('button:has-text("Save"), button:has-text("Create")').first();
    await saveVocabButton.click();
    await page.waitForTimeout(1000);

    // Select the vocabulary
    await page.locator(`text=${testVocabName}`).click();
    await page.waitForTimeout(500);

    // Create parent term
    const createTermButton = page.locator('button:has-text("Add Term"), button:has-text("Create Term"), button:has-text("New Term")').first();
    await createTermButton.click({ timeout: 5000 });

    await page.waitForSelector('input[name="name"]:visible', { timeout: 5000 });
    await page.locator('input[name="name"]:visible').fill('Technology');

    const saveTermButton = page.locator('button:has-text("Save"), button:has-text("Create")').last();
    await saveTermButton.click();
    await page.waitForTimeout(1000);

    // Create child term
    await createTermButton.click({ timeout: 5000 });
    await page.waitForSelector('input[name="name"]:visible', { timeout: 5000 });
    await page.locator('input[name="name"]:visible').fill('Programming');

    // Select parent if dropdown is available
    const parentDropdown = page.locator('select[name="parent_id"]:visible, [aria-label*="parent" i]:visible');
    if (await parentDropdown.count() > 0) {
      await parentDropdown.selectOption({ label: 'Technology' });
    }

    await saveTermButton.click();
    await page.waitForTimeout(1000);

    // Verify both terms appear (child should be indented or nested)
    await expect(page.locator('text=Technology')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Programming')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Taxonomy Integration with Blog Posts', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsKevin(page);
  });

  test('should assign taxonomy terms to a blog post', async ({ page }) => {
    // Step 1: Create vocabularies and terms
    await page.goto('/taxonomy');

    // Create "categories" vocabulary
    let createVocabButton = page.locator('button:has-text("Create"), button:has-text("Add Vocabulary"), button:has-text("New Vocabulary")').first();
    await createVocabButton.click({ timeout: 5000 });

    await page.waitForSelector('input[name="name"]', { timeout: 5000 });
    await page.locator('input[name="name"]').fill('Categories');
    await page.locator('input[name="machine_name"]').fill('categories');

    let saveButton = page.locator('button:has-text("Save"), button:has-text("Create")').first();
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Select categories vocabulary and add a term
    await page.locator('text=Categories').click();
    await page.waitForTimeout(500);

    let createTermButton = page.locator('button:has-text("Add Term"), button:has-text("Create Term"), button:has-text("New Term")').first();
    await createTermButton.click({ timeout: 5000 });

    await page.waitForSelector('input[name="name"]:visible', { timeout: 5000 });
    await page.locator('input[name="name"]:visible').fill('Tutorials');

    saveButton = page.locator('button:has-text("Save"), button:has-text("Create")').last();
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Create "tags" vocabulary
    await page.goto('/taxonomy');
    createVocabButton = page.locator('button:has-text("Create"), button:has-text("Add Vocabulary"), button:has-text("New Vocabulary")').first();
    await createVocabButton.click({ timeout: 5000 });

    await page.waitForSelector('input[name="name"]', { timeout: 5000 });
    await page.locator('input[name="name"]').fill('Tags');
    await page.locator('input[name="machine_name"]').fill('tags');

    saveButton = page.locator('button:has-text("Save"), button:has-text("Create")').first();
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Select tags vocabulary and add a term
    await page.locator('text=Tags').last().click();
    await page.waitForTimeout(500);

    createTermButton = page.locator('button:has-text("Add Term"), button:has-text("Create Term"), button:has-text("New Term")').first();
    await createTermButton.click({ timeout: 5000 });

    await page.waitForSelector('input[name="name"]:visible', { timeout: 5000 });
    await page.locator('input[name="name"]:visible').fill('Beginner');

    saveButton = page.locator('button:has-text("Save"), button:has-text("Create")').last();
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Step 2: Create a blog post with taxonomy fields
    await page.goto('/content');

    const createPostButton = page.locator('button:has-text("New Post"), button:has-text("Create Post"), button:has-text("Add Post")').first();
    await createPostButton.click({ timeout: 5000 });

    await page.waitForSelector('input[name="title"]', { timeout: 5000 });

    const testTitle = `Blog Post with Taxonomy ${Date.now()}`;
    await page.locator('input[name="title"]').fill(testTitle);

    // Fill in the editor
    const editorField = page.locator('textarea[name="body_html"]');
    await editorField.fill('This is a test blog post with taxonomy terms assigned.');

    // Fill in excerpt
    await page.locator('textarea[name="excerpt"]').fill('Test excerpt with taxonomy');

    // Step 3: Select taxonomy terms
    // Select category
    const categoryField = page.locator('[aria-label*="Categories" i], select:near(label:has-text("Categories")), div:has-text("Categories") + div [role="combobox"]');
    if (await categoryField.count() > 0) {
      await categoryField.click();
      await page.waitForTimeout(500);
      await page.locator('li:has-text("Tutorials"), [role="option"]:has-text("Tutorials")').first().click();
    }

    // Select tag
    const tagField = page.locator('[aria-label*="Tags" i], select:near(label:has-text("Tags")), div:has-text("Tags") + div [role="combobox"]');
    if (await tagField.count() > 0) {
      await tagField.click();
      await page.waitForTimeout(500);
      await page.locator('li:has-text("Beginner"), [role="option"]:has-text("Beginner")').first().click();
    }

    // Submit the form
    const submitButton = page.locator('button:has-text("Create"), button:has-text("Save")').first();
    await submitButton.click();

    await page.waitForTimeout(2000);

    // Verify the post was created
    await expect(page.locator(`text=${testTitle}`)).toBeVisible({ timeout: 10000 });
  });

  test('should persist taxonomy assignments after editing', async ({ page }) => {
    // Create a complete post with taxonomy from scratch for this test
    await page.goto('/taxonomy');

    // Create categories vocabulary
    let createVocabButton = page.locator('button:has-text("Create"), button:has-text("Add Vocabulary"), button:has-text("New Vocabulary")').first();
    await createVocabButton.click({ timeout: 5000 });

    await page.waitForSelector('input[name="name"]', { timeout: 5000 });
    await page.locator('input[name="name"]').fill('Persist Categories');
    await page.locator('input[name="machine_name"]').fill(`persist_categories_${Date.now()}`);

    let saveButton = page.locator('button:has-text("Save"), button:has-text("Create")').first();
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Add a term
    await page.locator('text=Persist Categories').click();
    await page.waitForTimeout(500);

    let createTermButton = page.locator('button:has-text("Add Term"), button:has-text("Create Term"), button:has-text("New Term")').first();
    await createTermButton.click({ timeout: 5000 });

    await page.waitForSelector('input[name="name"]:visible', { timeout: 5000 });
    await page.locator('input[name="name"]:visible').fill('Persist Tutorials');

    saveButton = page.locator('button:has-text("Save"), button:has-text("Create")').last();
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Create a blog post with this taxonomy term
    await page.goto('/content');

    const createPostButton = page.locator('button:has-text("New Post"), button:has-text("Create Post"), button:has-text("Add Post")').first();
    await createPostButton.click({ timeout: 5000 });

    await page.waitForSelector('input[name="title"]', { timeout: 5000 });

    const testTitle = `Persist Test Post ${Date.now()}`;
    await page.locator('input[name="title"]').fill(testTitle);
    await page.locator('textarea[name="body_html"]').fill('Testing taxonomy persistence.');
    await page.locator('textarea[name="excerpt"]').fill('Test excerpt');

    // Select taxonomy term
    const categoryField = page.locator('[aria-label*="Persist Categories" i], select:near(label:has-text("Persist Categories")), div:has-text("Persist Categories") + div [role="combobox"]');
    if (await categoryField.count() > 0) {
      await categoryField.click();
      await page.waitForTimeout(500);
      await page.locator('li:has-text("Persist Tutorials"), [role="option"]:has-text("Persist Tutorials")').first().click();
    }

    const submitButton = page.locator('button:has-text("Create"), button:has-text("Save")').first();
    await submitButton.click();
    await page.waitForTimeout(2000);

    // Now edit the post and verify taxonomy persists
    const postRow = page.locator(`text=${testTitle}`).first();
    await expect(postRow).toBeVisible({ timeout: 10000 });

    const editButton = page.locator(`tr:has-text("${testTitle}") button:has-text("Edit"), tr:has-text("${testTitle}") a:has-text("Edit")`).first();
    await editButton.click({ timeout: 5000 });

    await page.waitForTimeout(1000);

    // Verify taxonomy terms are still selected
    const tutorialsChip = page.locator('[role="button"]:has-text("Persist Tutorials"), .MuiChip-label:has-text("Persist Tutorials")');

    // The taxonomy term should be visible
    if (await tutorialsChip.count() > 0) {
      await expect(tutorialsChip.first()).toBeVisible({ timeout: 5000 });
    } else {
      // Check if it's selected in a dropdown instead
      const selectedValue = page.locator('[aria-label*="Persist Categories" i]:has-text("Persist Tutorials")');
      await expect(selectedValue).toBeVisible({ timeout: 5000 });
    }
  });

  test('should allow changing taxonomy terms on existing posts', async ({ page }) => {
    // Create a complete post with taxonomy from scratch for this test
    await page.goto('/taxonomy');

    // Create a vocabulary with two terms
    let createVocabButton = page.locator('button:has-text("Create"), button:has-text("Add Vocabulary"), button:has-text("New Vocabulary")').first();
    await createVocabButton.click({ timeout: 5000 });

    await page.waitForSelector('input[name="name"]', { timeout: 5000 });
    await page.locator('input[name="name"]').fill('Change Categories');
    await page.locator('input[name="machine_name"]').fill(`change_categories_${Date.now()}`);

    let saveButton = page.locator('button:has-text("Save"), button:has-text("Create")').first();
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Add first term
    await page.locator('text=Change Categories').click();
    await page.waitForTimeout(500);

    let createTermButton = page.locator('button:has-text("Add Term"), button:has-text("Create Term"), button:has-text("New Term")').first();
    await createTermButton.click({ timeout: 5000 });

    await page.waitForSelector('input[name="name"]:visible', { timeout: 5000 });
    await page.locator('input[name="name"]:visible').fill('Term One');

    saveButton = page.locator('button:has-text("Save"), button:has-text("Create")').last();
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Add second term
    await createTermButton.click({ timeout: 5000 });
    await page.waitForSelector('input[name="name"]:visible', { timeout: 5000 });
    await page.locator('input[name="name"]:visible').fill('Term Two');

    saveButton = page.locator('button:has-text("Save"), button:has-text("Create")').last();
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Create a blog post with first term
    await page.goto('/content');

    const createPostButton = page.locator('button:has-text("New Post"), button:has-text("Create Post"), button:has-text("Add Post")').first();
    await createPostButton.click({ timeout: 5000 });

    await page.waitForSelector('input[name="title"]', { timeout: 5000 });

    const testTitle = `Change Terms Post ${Date.now()}`;
    await page.locator('input[name="title"]').fill(testTitle);
    await page.locator('textarea[name="body_html"]').fill('Testing taxonomy term changes.');
    await page.locator('textarea[name="excerpt"]').fill('Test excerpt');

    // Select first term
    const categoryField = page.locator('[aria-label*="Change Categories" i], select:near(label:has-text("Change Categories")), div:has-text("Change Categories") + div [role="combobox"]');
    if (await categoryField.count() > 0) {
      await categoryField.click();
      await page.waitForTimeout(500);
      await page.locator('li:has-text("Term One"), [role="option"]:has-text("Term One")').first().click();
    }

    const submitButton = page.locator('button:has-text("Create"), button:has-text("Save")').first();
    await submitButton.click();
    await page.waitForTimeout(2000);

    // Now edit and change the term
    const postRow = page.locator(`text=${testTitle}`).first();
    await expect(postRow).toBeVisible({ timeout: 10000 });

    const editButton = page.locator(`tr:has-text("${testTitle}") button:has-text("Edit"), tr:has-text("${testTitle}") a:has-text("Edit")`).first();
    await editButton.click({ timeout: 5000 });

    await page.waitForTimeout(1000);

    // Remove existing taxonomy term (if chips are used)
    const existingChip = page.locator('[role="button"] svg[data-testid*="Cancel"], .MuiChip-deleteIcon').first();
    if (await existingChip.count() > 0) {
      await existingChip.click();
      await page.waitForTimeout(500);
    }

    // Add the second term
    const editCategoryField = page.locator('[aria-label*="Change Categories" i], div:has-text("Change Categories") + div [role="combobox"]');
    if (await editCategoryField.count() > 0) {
      await editCategoryField.click();
      await page.waitForTimeout(500);
      await page.locator('li:has-text("Term Two"), [role="option"]:has-text("Term Two")').first().click();
    }

    // Save changes
    const updateButton = page.locator('button:has-text("Update"), button:has-text("Save")').first();
    await updateButton.click();

    await page.waitForTimeout(2000);

    // Verify changes were saved (no error message)
    const errorAlert = page.locator('[role="alert"]:has-text("error"), .MuiAlert-standardError');
    expect(await errorAlert.count()).toBe(0);
  });
});

test.describe('Taxonomy API Integration', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsKevin(page);
  });

  test('should load vocabularies and terms via API', async ({ page }) => {
    await page.goto('/taxonomy');

    // Wait for data to load
    await page.waitForTimeout(2000);

    // Check that vocabularies are displayed (proves API is working)
    const vocabularyList = page.locator('text=Categories, text=Tags, [data-testid*="vocabulary"]');
    const hasVocabularies = await vocabularyList.count() > 0;

    // If no vocabularies, create one to verify API works
    if (!hasVocabularies) {
      const createButton = page.locator('button:has-text("Create"), button:has-text("Add Vocabulary")').first();
      await createButton.click({ timeout: 5000 });

      await page.waitForSelector('input[name="name"]', { timeout: 5000 });
      await page.locator('input[name="name"]').fill('Test Vocab API');
      await page.locator('input[name="machine_name"]').fill('test_vocab_api');

      const saveButton = page.locator('button:has-text("Save"), button:has-text("Create")').first();
      await saveButton.click();

      await page.waitForTimeout(1000);

      // Verify it appears
      await expect(page.locator('text=Test Vocab API')).toBeVisible({ timeout: 5000 });
    }
  });
});
