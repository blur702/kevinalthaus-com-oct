import { test } from '@playwright/test';

test('debug login page rendering', async ({ page }) => {
  const consoleMessages: string[] = [];
  const errors: string[] = [];

  // Capture console logs
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(text);
    // eslint-disable-next-line no-console
    console.log('BROWSER CONSOLE:', text);
  });

  // Capture errors
  page.on('pageerror', error => {
    errors.push(error.message);
    // eslint-disable-next-line no-console
    console.log('PAGE ERROR:', error.message);
  });

  // Capture failed requests
  page.on('requestfailed', request => {
    // eslint-disable-next-line no-console
    console.log('FAILED REQUEST:', request.url(), request.failure()?.errorText);
  });

  // Capture responses
  page.on('response', response => {
    if (response.status() >= 400) {
      // eslint-disable-next-line no-console
      console.log('ERROR RESPONSE:', response.status(), response.url());
      response.text().then(text => {
        if (text && text.length < 1000) {
          // eslint-disable-next-line no-console
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
  // eslint-disable-next-line no-console
  console.log('\n=== PAGE HTML ===');
  // eslint-disable-next-line no-console
  console.log(html);

  // Get the root div content
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-redundant-type-constituents
  const rootContent = await page.evaluate((): string => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const root = document.getElementById('root');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    return root?.innerHTML || 'ROOT IS EMPTY';
  });
  // eslint-disable-next-line no-console
  console.log('\n=== ROOT DIV CONTENT ===');
  // eslint-disable-next-line no-console
  console.log(rootContent);

  // Try to find any h4 elements
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment
  const h4Elements = await page.$$eval('h4', (elements: HTMLElement[]) =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    elements.map((el: HTMLElement) => el.textContent || '')
  );
  // eslint-disable-next-line no-console
  console.log('\n=== H4 ELEMENTS ===');
  // eslint-disable-next-line no-console
  console.log(h4Elements);

  // Try to find any input elements
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const inputs = await page.$$eval('input', (elements: HTMLInputElement[]) =>
    elements.map((el: HTMLInputElement) => ({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      name: el.getAttribute('name') || '',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      type: el.getAttribute('type') || ''
    }))
  );
  // eslint-disable-next-line no-console
  console.log('\n=== INPUT ELEMENTS ===');
  // eslint-disable-next-line no-console
  console.log(inputs);

  // Print summary
  // eslint-disable-next-line no-console
  console.log('\n=== SUMMARY ===');
  // eslint-disable-next-line no-console
  console.log('Console messages:', consoleMessages.length);
  // eslint-disable-next-line no-console
  console.log('Errors:', errors.length);

  // Screenshot
  await page.screenshot({ path: 'debug-login.png', fullPage: true });
  // eslint-disable-next-line no-console
  console.log('\n=== Screenshot saved to debug-login.png ===');
});
