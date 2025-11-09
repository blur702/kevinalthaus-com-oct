const { chromium } = require('@playwright/test');

(async () => {
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();

    const errors = [];
    const warnings = [];

    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        errors.push(text);
        console.log('BROWSER ERROR:', text);
      } else if (type === 'warning') {
        warnings.push(text);
        console.log('BROWSER WARNING:', text);
      }
    });

    page.on('pageerror', error => {
      errors.push(error.message);
      console.log('PAGE ERROR:', error.message);
    });

    try {
      await page.goto('http://localhost:3017/login', { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForTimeout(2000);

      console.log('\n=== PAGE TITLE ===');
      console.log(await page.title());

      console.log('\n=== BODY CONTENT ===');
      const bodyText = await page.evaluate(() => document.body.innerText);
      console.log(bodyText.substring(0, 500));

      console.log('\n=== ROOT DIV ===');
      const rootContent = await page.evaluate(() => document.getElementById('root')?.innerHTML || 'ROOT NOT FOUND');
      console.log(rootContent.substring(0, 500));

      console.log('\n=== ALL ERRORS ===');
      console.log(errors);

      console.log('\n=== ALL WARNINGS ===');
      console.log(warnings);

    } catch (e) {
      console.log('Navigation error:', e.message);
    }
  } finally {
    if (browser && typeof browser.close === 'function') {
      await browser.close();
    }
  }
})();
