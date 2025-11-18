# Testing & Automation Guide

## Overview

This project uses Playwright for end-to-end testing and CodeRabbit AI for automated code reviews. This document explains how to use these tools effectively.

## Table of Contents

1. [End-to-End Testing with Playwright](#end-to-end-testing-with-playwright)
2. [CodeRabbit AI Code Review](#coderabbit-ai-code-review)
3. [CI/CD Integration](#cicd-integration)
4. [Writing Tests](#writing-tests)
5. [Testing Best Practices](#testing-best-practices)
6. [Troubleshooting](#troubleshooting)

---

## End-to-End Testing with Playwright

### Installation

Playwright is already installed. To install browsers:

```bash
npx playwright install
```

### Running Tests

**Local development tests:**
```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode (recommended for debugging)
npm run test:e2e:ui

# Run in headed mode (see the browser)
npm run test:e2e:headed

# Debug specific test
npm run test:e2e:debug

# Run tests in specific browser
npm run test:e2e:chromium
npm run test:e2e:firefox
npm run test:e2e:webkit
```

**Production tests:**
```bash
# Test all production endpoints
npm run test:e2e:prod

# Test specific feature (blog CSRF)
npm run test:e2e:prod:blog
```

### Test Reports

After running tests, view the HTML report:

```bash
npm run test:e2e:report
```

Reports are saved in `playwright-report/` and include:
- Screenshots of failures
- Videos of test runs
- Execution traces
- Detailed logs

---

## CodeRabbit AI Code Review

### What is CodeRabbit?

CodeRabbit is an AI-powered code review tool that:
- Automatically reviews pull requests
- Detects security vulnerabilities
- Suggests code improvements
- Enforces coding standards
- Checks for CSRF, SQL injection, XSS, and other vulnerabilities

### Configuration

CodeRabbit is configured in `.coderabbit.yaml` with custom rules for:
- **CSRF Protection**: Ensures all state-changing endpoints use CSRF tokens
- **SQL Injection Prevention**: Requires parameterized queries
- **Authentication**: Verifies API routes require authentication
- **Input Validation**: Checks request validation
- **Error Handling**: Ensures async functions have try/catch blocks

### How It Works

1. **On Pull Request**: CodeRabbit automatically reviews the PR
2. **Security Scan**: Checks for vulnerabilities
3. **Quality Check**: Analyzes code complexity and style
4. **Test Verification**: Ensures tests pass
5. **Comment**: Posts review comments on the PR
6. **Auto-Approve**: Can auto-approve if all checks pass (currently disabled)

### Setup

To enable CodeRabbit:

1. **Install the CodeRabbit GitHub App**:
   - Go to https://github.com/apps/coderabbitai
   - Install on your repository

2. **Add API Token**:
   - Get token from CodeRabbit dashboard
   - Add to GitHub repository secrets as `CODERABBIT_TOKEN`

3. **Configure Notifications**:
   - Update email in `.coderabbit.yaml`
   - Set up webhook for Slack/Discord (optional)

---

## CI/CD Integration

### GitHub Actions Workflow

The CodeRabbit workflow (`.github/workflows/coderabbit.yml`) runs on:
- **Pull Requests**: Reviews code, runs tests, security scans
- **Push to main**: Runs production E2E tests

### Workflow Steps

1. **Code Review**:
   - Linting
   - Unit tests
   - E2E tests
   - CodeRabbit AI review
   - Security scan
   - Dependency review

2. **Production Tests** (on main branch):
   - Tests production blog CSRF functionality
   - Creates GitHub issue if tests fail
   - Uploads test results as artifacts

### Secrets Required

Add these to GitHub repository secrets:
- `CODERABBIT_TOKEN` - CodeRabbit API token
- `WEBHOOK_SECRET` - Production deployment webhook secret
- `TEST_ADMIN_EMAIL` - Admin email for E2E tests
- `TEST_ADMIN_PASSWORD` - Admin password for E2E tests

### Local Testing Environment Variables

For local E2E testing, create a `.env` file with:

```bash
# Required for E2E tests
TEST_ADMIN_EMAIL=your_admin_email
TEST_ADMIN_PASSWORD=your_admin_password

# Optional - defaults to http://localhost:4000 if not set
TEST_URL=http://localhost:4000
```

**Important Security Notes:**
- Never commit credentials to Git (`.env` is in `.gitignore`)
- Use different credentials for production tests
- Default TEST_URL is localhost to prevent accidental production mutations

---

## Writing Tests

### Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'user@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
  });

  test('should do something', async ({ page }) => {
    // Arrange
    await page.goto('/some-page');

    // Act
    await page.click('button#submit');

    // Assert
    await expect(page.locator('.success-message')).toBeVisible();
  });
});
```

### Testing CSRF Protection

```typescript
test('should include CSRF token', async ({ page }) => {
  const requests: any[] = [];

  page.on('request', request => {
    if (request.method() === 'POST') {
      requests.push({
        url: request.url(),
        headers: request.headers(),
      });
    }
  });

  await page.click('button#create');

  // Verify CSRF token is present
  expect(requests[0].headers['x-csrf-token']).toBeDefined();
});
```

### Best Practices

1. **Use Page Object Model** for reusable components
2. **Add @smoke and @regression tags** for categorization
3. **Test authentication flows separately** (no pre-authenticated state)
4. **Mock external dependencies** when possible
5. **Use meaningful test names** that describe behavior
6. **Keep tests independent** - don't rely on test order
7. **Clean up test data** after each test

---

## Testing Best Practices

### Security Testing

Always test for:
- ✅ **CSRF Protection**: All POST/PUT/DELETE requests include tokens
- ✅ **XSS Prevention**: User input is sanitized
- ✅ **SQL Injection**: Queries use parameterization
- ✅ **Authentication**: Protected routes require login
- ✅ **Authorization**: Users can only access their own data
- ✅ **Rate Limiting**: Prevent brute force attacks
- ✅ **Session Management**: Sessions expire correctly

### Performance Testing

Monitor:
- Page load times (< 3 seconds)
- API response times (< 500ms)
- Bundle sizes (< 500KB)
- Database query counts (avoid N+1)

### Accessibility Testing

Check for:
- WCAG AA compliance
- Keyboard navigation
- Screen reader compatibility
- Color contrast ratios
- Alt text for images

---

## Troubleshooting

### Common Issues

**1. Tests failing locally but passing in CI**
```bash
# Ensure you're using the same Node version
nvm use 22

# Clean install dependencies
rm -rf node_modules package-lock.json
npm install
```

**2. "Browser not installed" error**
```bash
npx playwright install chromium
```

**3. CSRF token not found**
- Check that user is logged in (cookies set)
- Verify `csrf-token` cookie exists in browser
- Ensure header name is lowercase: `x-csrf-token`

**4. Tests timing out**
- Increase timeout in `playwright.config.ts`
- Check if server is running
- Verify network connectivity

**5. Flaky tests**
- Add `await page.waitForLoadState('networkidle')`
- Use `await expect().toBeVisible({ timeout: 5000 })`
- Avoid fixed `page.waitForTimeout()` - use conditions instead

### Debug Mode

Run test in debug mode with step-by-step execution:

```bash
npm run test:e2e:debug
```

Or add `await page.pause()` in test code:

```typescript
test('debug this test', async ({ page }) => {
  await page.goto('/some-page');
  await page.pause(); // Opens Playwright Inspector
  await page.click('button');
});
```

### Viewing Traces

If a test fails, view the trace:

```bash
npx playwright show-trace test-results/.../trace.zip
```

---

## Continuous Improvement

### Adding New Tests

1. Create test file in `tests/e2e/`
2. Follow naming convention: `feature-name.spec.ts`
3. Add smoke/regression tags if applicable
4. Run locally before pushing
5. Update this documentation if needed

### Monitoring

- **GitHub Actions**: Check workflow runs
- **CodeRabbit Dashboard**: View review statistics
- **Playwright Report**: Analyze test results
- **Sentry**: Monitor production errors

### Metrics to Track

- Test coverage (target: > 80%)
- Test execution time (target: < 10 minutes)
- Flaky test rate (target: < 5%)
- Security vulnerabilities (target: 0)
- Code quality score (target: A grade)

---

## Resources

- [Playwright Documentation](https://playwright.dev)
- [CodeRabbit Documentation](https://docs.coderabbit.ai)
- [GitHub Actions](https://docs.github.com/en/actions)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

## Support

For issues or questions:
- Create an issue in the GitHub repository
- Email: contact@kevinalthaus.com
- Check existing documentation in `/docs`
