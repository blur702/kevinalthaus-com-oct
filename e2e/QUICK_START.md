# E2E Testing - Quick Start Guide

Quick reference for running and working with E2E tests.

## Prerequisites

```bash
# Verify Node.js version (must be 20+)
node --version

# Install dependencies
npm install

# Install Playwright browsers (one-time)
npx playwright install
```

## Running Tests

### Common Commands

```bash
# Run all tests
npm run test:e2e

# Run with UI (recommended for development)
npm run test:e2e:ui

# Run specific browser
npm run test:e2e:chromium
npm run test:e2e:firefox
npm run test:e2e:webkit

# Run specific file
npx playwright test e2e/auth.spec.ts

# Run specific test
npx playwright test -g "should login successfully"

# Debug mode
npm run test:e2e:debug

# Headed mode (see browser)
npm run test:e2e:headed

# View report
npm run test:e2e:report
```

## Test Files

- `e2e/auth.spec.ts` - Authentication tests (login, logout, session)
- `e2e/dashboard.spec.ts` - Dashboard tests (stats, API, fallback)
- `e2e/users.spec.ts` - User management tests (CRUD, pagination, search)

## Test Utilities

### Authentication

```typescript
import { login, logout, TEST_CREDENTIALS } from './utils/auth';

// Login
await login(page, TEST_CREDENTIALS.ADMIN.username, TEST_CREDENTIALS.ADMIN.password);

// Logout
await logout(page);
```

### API Helpers

```typescript
import { createUserViaApi, deleteUserViaApi } from './utils/api';

// Create test user
const user = await createUserViaApi(page, {
  username: 'testuser',
  email: 'test@example.com',
  password: 'Password123!',
});

// Cleanup
await deleteUserViaApi(page, user.id);
```

### Test Data

```typescript
import { createTestUser } from './utils/fixtures';

// Generate test user
const testUser = createTestUser();
```

### Selectors

```typescript
import { selectors } from './utils/selectors';

// Use predefined selectors
await page.click(selectors.users.createButton);
await page.fill(selectors.auth.usernameInput, 'username');
```

## Debugging

### View Screenshots

```bash
# Screenshots saved on failure
ls test-results/*/test-failed-*.png
```

### View Trace

```bash
# Open trace viewer
npx playwright show-trace test-results/path-to-trace.zip
```

### Debug Specific Test

```bash
# Run with inspector
npx playwright test --debug -g "test name"

# Pause execution
await page.pause();
```

## Common Issues

### Port Already in Use

```bash
# Kill process on port 3003
lsof -ti:3003 | xargs kill -9
```

### Tests Timeout

```typescript
// Increase timeout for slow operations
await page.waitForSelector(selector, { timeout: 30000 });
```

### Element Not Found

```typescript
// Wait for element
await page.waitForSelector(selector, { state: 'visible' });

// Check if exists
const exists = await page.locator(selector).count() > 0;
```

## Test Credentials

- **Username**: kevin
- **Password**: (130Bpm)

## Directory Structure

```
e2e/
├── auth.spec.ts          # Authentication tests
├── dashboard.spec.ts     # Dashboard tests
├── users.spec.ts         # User management tests
├── global-setup.ts       # Global setup
├── utils/                # Test utilities
│   ├── auth.ts
│   ├── api.ts
│   ├── fixtures.ts
│   └── selectors.ts
├── README.md             # Full documentation
└── QUICK_START.md        # This file
```

## CI/CD

Tests run automatically on:
- Push to main/master/develop
- Pull requests
- Manual trigger

View results in GitHub Actions tab.

## Resources

- Full documentation: `e2e/README.md`
- Playwright docs: https://playwright.dev
- Project guide: `CLAUDE.md`

---

For detailed information, see `e2e/README.md`.
