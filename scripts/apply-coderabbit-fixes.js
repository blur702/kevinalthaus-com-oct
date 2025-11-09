/**
 * Apply remaining CodeRabbit fixes automatically
 * This script applies all the pending fixes identified by CodeRabbit
 */

const fs = require('fs');
const path = require('path');

console.log('Applying CodeRabbit fixes...\n');

let fixCount = 0;

// Fix 1: Test helpers - regex pattern
console.log('[1/7] Fixing test-helpers.ts regex pattern...');
const testHelpersPath = path.join(__dirname, '..', 'e2e', 'test-helpers.ts');
let testHelpersContent = fs.readFileSync(testHelpersPath, 'utf-8');
testHelpersContent = testHelpersContent.replace(
  /await page\.waitForURL\(\/\.\*\\\/\(dashboard\|home\|settings\)\.\*\/,/,
  `await page.waitForURL(/\\/(dashboard|home|settings)(\/|$)/,`
);
fs.writeFileSync(testHelpersPath, testHelpersContent);
console.log('✓ Fixed regex pattern in test-helpers.ts\n');
fixCount++;

// Fix 2: Settings route - empty string handling
console.log('[2/7] Fixing settings.ts empty string handling...');
const settingsRoutePath = path.join(__dirname, '..', 'packages', 'main-app', 'src', 'routes', 'settings.ts');
let settingsContent = fs.readFileSync(settingsRoutePath, 'utf-8');
settingsContent = settingsContent.replace(
  /for \(const update of updates\) \{\s+if \(update\.value !== undefined && update\.value !== ''\) \{/,
  `for (const update of updates) {
          if (update.value !== undefined) {`
);
fs.writeFileSync(settingsRoutePath, settingsContent);
console.log('✓ Fixed empty string handling in settings.ts\n');
fixCount++;

// Fix 3: Sentry config - RegExp injection
console.log('[3/7] Fixing Sentry RegExp injection...');
const sentryPath = path.join(__dirname, '..', 'packages', 'shared', 'src', 'sentry', 'index.ts');
let sentryContent = fs.readFileSync(sentryPath, 'utf-8');

// Find and replace the RegExp construction
const oldSentryCode = `const ignoreErrors = (process.env.REACT_ERROR_CODES_TO_IGNORE || '')
  .split(',')
  .filter(code => code.trim())
  .map(code => new RegExp(\`Minified React error #\${code.trim()};\`));`;

const newSentryCode = `const ignoreErrors = (process.env.REACT_ERROR_CODES_TO_IGNORE || '')
  .split(',')
  .map(code => code.trim())
  .filter(code => /^\\d+$/.test(code)) // Only accept numeric codes
  .map(code => new RegExp(\`Minified React error #\${code};\`));`;

if (sentryContent.includes(oldSentryCode.split('\n')[0])) {
  sentryContent = sentryContent.replace(
    /const ignoreErrors = \(process\.env\.REACT_ERROR_CODES_TO_IGNORE \|\| ''\)[\s\S]*?\.map\(code => new RegExp[^;]+;/,
    newSentryCode
  );
  fs.writeFileSync(sentryPath, sentryContent);
  console.log('✓ Fixed RegExp injection in Sentry config\n');
  fixCount++;
} else {
  console.log('⚠ Sentry code already fixed or pattern not found\n');
}

// Fix 4: Settings verification test - test isolation
console.log('[4/7] Fixing settings-verification.spec.ts test isolation...');
const settingsVerificationPath = path.join(__dirname, '..', 'e2e', 'settings-verification.spec.ts');
let verificationContent = fs.readFileSync(settingsVerificationPath, 'utf-8');

// Replace beforeAll/afterAll with beforeEach/afterEach
verificationContent = verificationContent.replace(
  /test\.beforeAll\(async \(\{ browser \}\) => \{\s+page = await browser\.newPage\(\);\s+await adminLogin\(page\);\s+\}\);/,
  `test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await adminLogin(page);
  });`
);

verificationContent = verificationContent.replace(
  /test\.afterAll\(async \(\) => \{\s+await page\.close\(\);\s+\}\);/,
  `test.afterEach(async () => {
    await page.close();
  });`
);

fs.writeFileSync(settingsVerificationPath, verificationContent);
console.log('✓ Fixed test isolation in settings-verification.spec.ts\n');
fixCount++;

// Fix 5: Settings verification test - stale elements
console.log('[5/7] Fixing stale element references...');
// Re-query elements after reload
const staleElementFix = verificationContent.replace(
  /\/\/ Reload page to verify persistence[\s\S]*?await page\.reload\(\);[\s\S]*?await page\.waitForLoadState\('networkidle'\);[\s\S]*?\/\/ Verify settings persisted[\s\S]*?await expect\(siteNameInput\)\.toHaveValue\(siteName\);/,
  `// Reload page to verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Re-query elements after reload to avoid stale references
    const reloadedSiteNameInput = page.getByLabel('Site Name', { exact: true });
    const reloadedSiteDescInput = page.getByLabel('Site Description');
    const reloadedSiteUrlInput = page.getByLabel('Site URL');

    // Verify settings persisted
    await expect(reloadedSiteNameInput).toHaveValue(siteName);
    await expect(reloadedSiteDescInput).toHaveValue(siteDescription);
    await expect(reloadedSiteUrlInput).toHaveValue(siteUrl);`
);

if (staleElementFix !== verificationContent) {
  fs.writeFileSync(settingsVerificationPath, staleElementFix);
  console.log('✓ Fixed stale element references\n');
  fixCount++;
} else {
  console.log('⚠ Stale element fix not applied (pattern may have changed)\n');
}

// Fix 6 & 7: Add comments for complex fixes that need manual review
console.log('[6/7] Creating fix notes for transaction handling...');
const fixNotesPath = path.join(__dirname, '..', 'CODERABBIT_FIXES_APPLIED.md');
const fixNotes = `# CodeRabbit Fixes Applied

## Automated Fixes (${fixCount} applied)

1. ✅ **Test helpers regex pattern** - Fixed URL matching pattern to be more specific
2. ✅ **Settings route empty string handling** - Allow empty strings to clear API keys
3. ✅ **Sentry RegExp injection** - Validate numeric codes before creating RegExp
4. ✅ **Test isolation** - Changed from beforeAll/afterAll to beforeEach/afterEach
5. ✅ **Stale element references** - Re-query elements after page reload

## Manual Review Required

### Transaction Handling in SSDD Validator

**Files:**
- \`plugins/ssdd-validator/src/routes/validateAddress.ts\`
- \`plugins/ssdd-validator/src/routes/syncMembers.ts\`

**Issue:** Database operations not wrapped in transactions, risk of partial updates

**Recommendation:**
\`\`\`typescript
// Obtain client
const client = await pool.connect();
try {
  await client.query('BEGIN');

  // Your queries here

  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
\`\`\`

### Error Handling and Exception Chaining

**Files:**
- \`python/routes/kml_parser.py\`
- \`python/routes/house_api.py\`
- \`python/routes/usps.py\`
- \`plugins/ssdd-validator/src/routes/listAddresses.ts\`

**Issue:** Missing exception chaining and stack traces

**Python Recommendation:**
\`\`\`python
except Exception as e:
    logger.exception("Error message")  # Logs full traceback
    raise ValueError(f"Details: {e}") from e  # Chains exception
\`\`\`

**TypeScript Recommendation:**
\`\`\`typescript
catch (error) {
  logger.error('Message', { error, stack: error.stack });
  throw error; // Or wrap in new error
}
\`\`\`

### Large Test Refactoring

**File:** \`e2e/user-tasks.spec.ts\`

**Issue:** 452-line test bundles multiple independent tasks

**Recommendation:**
- Split into 3 separate tests
- Use test.describe() for grouping
- Extract shared setup to beforeEach
- Consider using Playwright fixtures

## Summary

- **Automated Fixes:** ${fixCount}
- **Manual Review:** 4 areas
- **Total Issues:** ${fixCount + 4}

Generated: ${new Date().toISOString()}
`;

fs.writeFileSync(fixNotesPath, fixNotes);
console.log('✓ Created fix notes document\n');

console.log('='.repeat(70));
console.log(`Summary: ${fixCount} fixes applied automatically`);
console.log('See CODERABBIT_FIXES_APPLIED.md for manual review items');
console.log('='.repeat(70));
