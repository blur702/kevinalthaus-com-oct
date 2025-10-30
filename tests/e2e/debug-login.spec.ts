import { test } from '@playwright/test';

test('debug login page rendering', async ({ page }) => {
  const consoleMessages: string[] = [];
  const errors: string[] = [];

  // Capture console logs
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(text);
    console.log('BROWSER CONSOLE:', text);
  });

  // Capture errors
  page.on('pageerror', error => {
    errors.push(error.message);
    console.log('PAGE ERROR:', error.message);
  });

  // Capture failed requests
  page.on('requestfailed', request => {
    console.log('FAILED REQUEST:', request.url(), request.failure()?.errorText);
  });

  // Capture responses
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log('ERROR RESPONSE:', response.status(), response.url());
      response.text().then(text => {
        if (text && text.length < 1000) {
          console.log('ERROR BODY:', text);
        }
      }).catch(() => {});
    }
  });

  // Navigate to login page
  await page.goto('http://localhost:3017/login', { waitUntil: 'networkidle' });

  // Wait a moment for JavaScript to execute
  await page.waitForTimeout(2000);

  // Get the HTML content
  const html = await page.content();
  console.log('\n=== PAGE HTML ===');
  console.log(html);

  // Get the root div content
  const rootContent = await page.evaluate(() => document.getElementById('root')?.innerHTML || 'ROOT IS EMPTY');
  console.log('\n=== ROOT DIV CONTENT ===');
  console.log(rootContent);

  // Try to find any h4 elements
  const h4Elements = await page.$$eval('h4', elements => elements.map(el => el.textContent));
  console.log('\n=== H4 ELEMENTS ===');
  console.log(h4Elements);

  // Try to find any input elements
  const inputs = await page.$$eval('input', elements => elements.map(el => ({ name: el.getAttribute('name'), type: el.getAttribute('type') })));
  console.log('\n=== INPUT ELEMENTS ===');
  console.log(inputs);

  // Print summary
  console.log('\n=== SUMMARY ===');
  console.log('Console messages:', consoleMessages.length);
  console.log('Errors:', errors.length);

  // Screenshot
  await page.screenshot({ path: 'debug-login.png', fullPage: true });
  console.log('\n=== Screenshot saved to debug-login.png ===');
});
