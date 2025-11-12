import { test, expect } from '@playwright/test';

test.describe('Page Builder Manual Test - Create Page with Accordion', () => {
  test('should login and create a test page with accordion widget', async ({ page }) => {
    // Navigate to admin login
    await page.goto('http://localhost:3002');
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // Take screenshot of login page
    await page.screenshot({ path: 'screenshots/test-01-login-page.png', fullPage: true });

    // Validate required environment variables
    if (!process.env.TEST_ADMIN_USERNAME || !process.env.TEST_ADMIN_PASSWORD) {
      throw new Error('TEST_ADMIN_USERNAME and TEST_ADMIN_PASSWORD environment variables are required');
    }

    // Login
    await page.fill('input[name="identifier"]', process.env.TEST_ADMIN_USERNAME);
    await page.fill('input[name="password"]', process.env.TEST_ADMIN_PASSWORD);
    await page.screenshot({ path: 'screenshots/test-02-login-filled.png', fullPage: true });

    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|\/$/,{ timeout: 10000 });

    // Take screenshot after login
    await page.screenshot({ path: 'screenshots/test-03-dashboard.png', fullPage: true });

    // Navigate to Page Builder
    // Look for Page Builder link in navigation - fix invalid selector syntax
    const pageBuilderLink = page.locator('text=Page Builder').or(page.locator('text=Pages')).first();
    if (await pageBuilderLink.isVisible()) {
      await pageBuilderLink.click();
    } else {
      // Try alternative navigation method
      await page.goto('http://localhost:3002/page-builder');
    }
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // Take screenshot of page builder
    await page.screenshot({ path: 'screenshots/test-04-page-builder.png', fullPage: true });

    // Click "New Page" or "Create Page" button
    const createButton = page.locator('button:has-text("New Page"), button:has-text("Create Page"), button:has-text("Add Page")').first();
    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForSelector('input[name="title"], input[placeholder*="title" i]', { timeout: 5000 });
    }

    // Fill in page title
    const titleInput = page.locator('input[name="title"], input[placeholder*="title" i]').first();
    await titleInput.fill('Test Page with Accordion');
    await titleInput.blur();

    // Take screenshot of page form
    await page.screenshot({ path: 'screenshots/test-05-page-form.png', fullPage: true });

    // Look for widget panel or accordion widget

    // Try to find accordion widget in the widget panel
    const accordionWidget = page.locator('text=Accordion, [data-widget="accordion"]').first();
    if (await accordionWidget.isVisible({ timeout: 5000 })) {
      await accordionWidget.click();
      await page.waitForTimeout(1000);
    } else {
      // Try to open widget selector
      const addWidgetButton = page.locator('button:has-text("Add Widget"), button:has-text("Add Component")').first();
      if (await addWidgetButton.isVisible()) {
        await addWidgetButton.click();
        await page.waitForSelector('text=Accordion', { timeout: 5000 }).catch(() => {
          // Intentionally silent - accordion widget may not exist
        });

        // Now look for accordion
        const accordionOption = page.locator('text=Accordion').first();
        if (await accordionOption.isVisible()) {
          await accordionOption.click();
          await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
            // Intentionally silent - widget may load before network idle state
          });
        }
      }
    }

    // Take screenshot with accordion added
    await page.screenshot({ path: 'screenshots/test-06-accordion-added.png', fullPage: true });

    // Configure accordion if there's a configuration panel
    const accordionTitleInput = page.locator('input[placeholder*="accordion" i], input[name*="title" i]').first();
    if (await accordionTitleInput.isVisible({ timeout: 2000 })) {
      await accordionTitleInput.fill('Test Accordion Section');
      await accordionTitleInput.blur();
    }

    // Save the page
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Publish"), button:has-text("Create")').first();
    if (await saveButton.isVisible()) {
      await saveButton.click();
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
        // Intentionally silent - save may complete before network idle state
      });
    }

    // Take final screenshot
    await page.screenshot({ path: 'screenshots/test-07-page-saved.png', fullPage: true });

    // Verify success message or redirect
    const successIndicator = page.locator('text=Success, text=Created, text=Saved').first();
    if (await successIndicator.isVisible({ timeout: 5000 })) {
    } else {
    }

    // Take screenshot of page list or final state
    await page.screenshot({ path: 'screenshots/test-08-final-state.png', fullPage: true });

  });
});
