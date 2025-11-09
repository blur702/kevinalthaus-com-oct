# Sentry Integration

## Overview

Sentry error tracking has been successfully integrated into the React applications (Frontend and Admin packages). This provides real-time error monitoring, performance tracking, and session replay capabilities in production.

## Configuration

### Environment Variables

The following environment variables have been added to `.env.example` and `.env`:

```bash
# Sentry Error Tracking
VITE_SENTRY_DSN=YOUR_SENTRY_DSN_HERE
VITE_APP_VERSION=1.0.0
```

- **VITE_SENTRY_DSN**: Your Sentry DSN (Data Source Name) from the Sentry project
- **VITE_APP_VERSION**: Application version for release tracking

## Implementation Details

### Shared Package

A centralized Sentry configuration utility was created in `packages/shared/src/sentry/index.ts`:

**Key Features:**
- Configurable initialization with sensible defaults
- Privacy-focused: filters sensitive data from URLs (tokens, passwords, etc.)
- Error filtering: ignores browser extension errors and non-actionable network errors
- Performance monitoring with configurable sample rates
- Session replay for debugging
- Automatic environment detection

**Exported Functions:**
- `initializeSentry(config)`: Initialize Sentry with custom configuration
- `SentryErrorBoundary`: React error boundary component
- `captureException(error)`: Manually capture exceptions
- `captureMessage(message, level)`: Capture custom messages
- `setSentryUser(user)`: Set user context for error tracking
- `addBreadcrumb(breadcrumb)`: Add debugging breadcrumbs
- `getCurrentScope()`: Get current Sentry scope
- `withProfiler()`: Wrap components with performance profiling

### Frontend Integration

**Location:** `packages/frontend/src/main.tsx`

- Sentry initializes as early as possible before React renders
- Error boundary wraps the entire application
- Fallback UI shows when errors occur with "Try again" button
- Only enabled in production builds by default

### Admin Integration

**Location:** `packages/admin/src/main.tsx`

- Same configuration as Frontend
- Separate Sentry initialization for independent tracking

### Test Page

A test page was created at `/sentry-test` (Frontend only) to verify the integration:

**Location:** `packages/frontend/src/pages/SentryTestPage.tsx`

**Test Actions:**
1. **Test Caught Error**: Triggers a caught exception and sends it to Sentry
2. **Test Message Capture**: Sends an info message to Sentry
3. **Test Error Boundary**: Throws an uncaught error to test the error boundary

## Configuration Options

The `initializeSentry()` function accepts the following options:

```typescript
interface SentryConfig {
  dsn: string;                          // Required: Sentry DSN
  environment?: string;                 // Default: process.env.NODE_ENV
  release?: string;                     // Default: VITE_APP_VERSION
  sampleRate?: number;                  // Default: 1.0 (100%)
  tracesSampleRate?: number;            // Default: 0.1 (10% of transactions)
  replaysSessionSampleRate?: number;    // Default: 0.1 (10% of sessions)
  replaysOnErrorSampleRate?: number;    // Default: 1.0 (100% of errors)
  sendDefaultPii?: boolean;             // Default: true
  enabled?: boolean;                    // Default: production only
}
```

## Privacy & Security

**Data Filtering:**
- Sensitive URL parameters are automatically redacted (token, password, secret, key)
- Browser storage data is not sent to Sentry
- Configurable PII (Personally Identifiable Information) settings

**Ignored Errors:**
- Browser extension errors
- ResizeObserver loop errors
- Non-actionable network errors (Failed to fetch, etc.)
- Minified React errors (use source maps to decode)

## Production Deployment

### Enable Sentry in Production

Sentry is automatically enabled when `import.meta.env.PROD === true`. To test in development:

```typescript
initializeSentry({
  dsn: import.meta.env.VITE_SENTRY_DSN || '',
  enabled: true, // Force enable in development
});
```

### Source Maps

To get readable stack traces in Sentry, you need to upload source maps:

1. Install Sentry CLI:
   ```bash
   npm install --save-dev @sentry/vite-plugin
   ```

2. Update `vite.config.ts`:
   ```typescript
   import { sentryVitePlugin } from '@sentry/vite-plugin';

   export default defineConfig({
     build: {
       sourcemap: true,
     },
     plugins: [
       react(),
       sentryVitePlugin({
         org: 'your-org',
         project: 'your-project',
         authToken: process.env.SENTRY_AUTH_TOKEN,
       }),
     ],
   });
   ```

3. Set environment variable:
   ```bash
   SENTRY_AUTH_TOKEN=your_auth_token
   ```

## Testing

### Manual Testing

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to `/sentry-test` in the Frontend application

3. Click each test button to verify:
   - Errors are captured
   - Messages are sent
   - Error boundary displays fallback UI

### Production Testing

1. Build the applications:
   ```bash
   npm run build
   ```

2. Deploy to staging/production

3. Trigger a test error and verify it appears in Sentry dashboard

## Monitoring

### Sentry Dashboard

Access your Sentry dashboard at: https://sentry.io

**Key Metrics:**
- Error count and frequency
- Affected users
- Release versions
- Performance metrics
- Session replays

### User Context

To associate errors with specific users:

```typescript
import { setSentryUser } from '@monorepo/shared';

// After user logs in
setSentryUser({
  id: user.id,
  email: user.email,
  username: user.username,
});

// On logout
setSentryUser(null);
```

## Browser Entry Point

The Frontend and Admin packages use a special browser-safe entry point (`@monorepo/shared` → `packages/shared/src/browser.ts`) that excludes server-only dependencies like bcrypt. This prevents build errors and reduces bundle size.

**Vite Configuration:**
```typescript
resolve: {
  alias: {
    '@monorepo/shared': resolve(__dirname, '../shared/src/browser.ts'),
  },
}
```

## Troubleshooting

### Errors not appearing in Sentry

1. Check that `VITE_SENTRY_DSN` is set correctly
2. Verify Sentry is enabled: `enabled: true` or `NODE_ENV === 'production'`
3. Check browser console for Sentry initialization message
4. Verify network requests to Sentry are not blocked

### Build errors related to Sentry

1. Ensure `@sentry/react` and `@sentry/browser` are installed
2. Verify TypeScript types are available
3. Check that vite-env.d.ts includes Sentry environment variables
4. Rebuild shared package: `cd packages/shared && npm run build`

### Type errors

TypeScript definitions are included in the Sentry SDK. If you encounter type errors:
```bash
npm install --save-dev @types/react
```

## Files Modified

- `packages/shared/src/sentry/index.ts` - Sentry utility and configuration
- `packages/shared/src/index.ts` - Export Sentry module
- `packages/shared/src/browser.ts` - Export Sentry for browser builds
- `packages/frontend/src/main.tsx` - Initialize Sentry in Frontend
- `packages/frontend/src/App.tsx` - Add Sentry test route
- `packages/frontend/src/pages/SentryTestPage.tsx` - Test page component
- `packages/frontend/src/vite-env.d.ts` - TypeScript environment definitions
- `packages/frontend/vite.config.ts` - Vite alias configuration
- `packages/admin/src/main.tsx` - Initialize Sentry in Admin
- `packages/admin/src/vite-env.d.ts` - TypeScript environment definitions
- `.env.example` - Environment variable documentation
- `.env` - Environment variable configuration (gitignored)

## Next Steps

1. **Set up Alerts**: Configure Sentry alerts for critical errors
2. **Performance Monitoring**: Review and adjust trace sample rates
3. **User Feedback**: Integrate Sentry's user feedback widget
4. **Release Tracking**: Automate version bumps and release tracking
5. **Integration**: Connect Sentry with Slack, PagerDuty, or Jira

## Resources

- [Sentry Documentation](https://docs.sentry.io/)
- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [Sentry React SDK](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Session Replay](https://docs.sentry.io/product/session-replay/)
