const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: false,
  });
  const page = await context.newPage();

  try {
    console.log('1. Navigating to admin login page...');
    await page.goto('https://kevinalthaus.com/admin', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000); // Wait for React to render
    await page.screenshot({ path: 'screenshots/01-admin-login.png', fullPage: true });
    console.log('   ✓ Screenshot saved: 01-admin-login.png');

    // Check if we're on login page
    const isLoginPage = await page.locator('input[name="username"], input[type="text"]').first().isVisible();
    if (isLoginPage) {
      console.log('2. Filling in login form...');
      await page.fill('input[name="username"], input[type="text"]', 'kevin');
      await page.fill('input[name="password"], input[type="password"]', '(130Bpm)');
      await page.screenshot({ path: 'screenshots/02-login-filled.png', fullPage: true });
      console.log('   ✓ Screenshot saved: 02-login-filled.png');

      console.log('3. Submitting login...');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'screenshots/03-after-login.png', fullPage: true });
      console.log('   ✓ Screenshot saved: 03-after-login.png');
    } else {
      console.log('2. Already logged in or different page structure');
    }

    // Wait for navigation to complete
    await page.waitForTimeout(2000);
    console.log('   Current URL:', page.url());

    console.log('4. Checking Dashboard...');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/04-dashboard.png', fullPage: true });
    console.log('   ✓ Screenshot saved: 04-dashboard.png');
    console.log('   Current URL:', page.url());

    console.log('5. Clicking on Taxonomy menu item...');
    // Try different selectors for the Taxonomy link
    const taxonomyLink = page.locator('text=Taxonomy').first();
    if (await taxonomyLink.isVisible()) {
      await taxonomyLink.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'screenshots/05-taxonomy-page.png', fullPage: true });
      console.log('   ✓ Screenshot saved: 05-taxonomy-page.png');
      console.log('   Current URL:', page.url());

      // Check if we got redirected to login
      const currentUrl = page.url();
      if (currentUrl.includes('/login')) {
        console.log('   ✗ ERROR: Redirected to login page! Login loop detected.');
      } else {
        console.log('   ✓ SUCCESS: Taxonomy page loaded without redirect');
      }
    } else {
      console.log('   ✗ Taxonomy link not found in sidebar');
    }

    console.log('6. Testing other menu items...');

    // Test Users page
    const usersLink = page.locator('text=Users').first();
    if (await usersLink.isVisible()) {
      await usersLink.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'screenshots/06-users-page.png', fullPage: true });
      console.log('   ✓ Screenshot saved: 06-users-page.png');
      console.log('   Users page URL:', page.url());
    }

    // Test Menus page
    const menusLink = page.locator('text=Menus').first();
    if (await menusLink.isVisible()) {
      await menusLink.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'screenshots/07-menus-page.png', fullPage: true });
      console.log('   ✓ Screenshot saved: 07-menus-page.png');
      console.log('   Menus page URL:', page.url());
    }

    console.log('\n✓ Test completed successfully!');
    console.log('Screenshots saved to screenshots/ directory');

  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    await page.screenshot({ path: 'screenshots/error.png', fullPage: true });
    console.log('Error screenshot saved: screenshots/error.png');
    throw error;
  } finally {
    await browser.close();
  }
})();
