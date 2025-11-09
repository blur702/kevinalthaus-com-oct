# Sentry Authentication Setup

## Runtime Error Tracking (Already Working)

Your Sentry DSN is already configured in `.env`:
```bash
VITE_SENTRY_DSN=https://fb66a40836e26818e1817d691e371ac7@o4510324179206144.ingest.us.sentry.io/4510324182220800
```

This DSN serves as the authentication for your app to send errors to Sentry. **No additional setup needed for basic error tracking!**

## Source Map Upload (Optional - For Better Stack Traces)

To get readable stack traces in production, you can upload source maps to Sentry.

### Step 1: Create Sentry Auth Token

1. Log in to https://sentry.io
2. Go to **Settings** → **Account** → **API** → **Auth Tokens**
3. Click **Create New Token**
4. Set the following:
   - **Name**: "Source Map Upload - kevinalthaus-com-oct"
   - **Scopes**: Select:
     - `project:read`
     - `project:write`
     - `project:releases`
   - **Organization**: Your organization
5. Click **Create Token**
6. Copy the token (you won't be able to see it again!)

### Step 2: Add Token to Environment

Add to your `.env` file (this is gitignored):
```bash
# Sentry Auth Token for source map uploads (keep secret!)
SENTRY_AUTH_TOKEN=sntrys_YOUR_TOKEN_HERE
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
```

### Step 3: Install Sentry Vite Plugin

```bash
npm install --save-dev @sentry/vite-plugin
```

### Step 4: Update Vite Configs

Update `packages/frontend/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    // Upload source maps to Sentry on production builds
    process.env.NODE_ENV === 'production' && process.env.SENTRY_AUTH_TOKEN
      ? sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          release: {
            name: process.env.VITE_APP_VERSION || '1.0.0',
          },
        })
      : undefined,
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@monorepo/shared': resolve(__dirname, '../shared/src/browser.ts'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true, // Required for source map upload
  },
});
```

Do the same for `packages/admin/vite.config.ts`.

### Step 5: Test Source Map Upload

```bash
# Build for production
npm run build

# Check that source maps are uploaded
# You should see output like:
# > Upload source maps to Sentry
# > Successfully uploaded source maps for release 1.0.0
```

## Verifying the Integration

### Test Runtime Error Tracking

1. Start your dev server:
   ```bash
   npm run dev:clean
   ```

2. Open http://localhost:3002/sentry-test

3. Click "Test Caught Error" button

4. Check your Sentry dashboard at https://sentry.io
   - You should see the error appear (if in production mode)
   - In development, errors are logged to console only

### Production Test

1. Build and deploy to production:
   ```bash
   npm run build
   # Deploy to your hosting provider
   ```

2. Visit your production site and trigger an error

3. Check Sentry dashboard - errors should appear within seconds

## Troubleshooting

### Errors not appearing in Sentry

**Issue**: No errors showing up in Sentry dashboard

**Solutions**:
1. Check that you're in production mode: `NODE_ENV=production` or `import.meta.env.PROD === true`
2. Verify DSN is correct in `.env`
3. Check browser console for Sentry initialization message: `[Sentry] Initialized for environment: production`
4. Check Network tab for requests to `sentry.io` - they should return 200 status
5. Temporarily enable in development:
   ```typescript
   initializeSentry({
     dsn: import.meta.env.VITE_SENTRY_DSN || '',
     enabled: true, // Force enable for testing
   });
   ```

### Source maps not uploading

**Issue**: Source maps fail to upload during build

**Solutions**:
1. Verify `SENTRY_AUTH_TOKEN` is set correctly
2. Check token has correct scopes: `project:read`, `project:write`, `project:releases`
3. Verify `SENTRY_ORG` and `SENTRY_PROJECT` match your Sentry settings
4. Check build output for Sentry plugin errors
5. Ensure `sourcemap: true` is set in vite build config

### DSN not found error

**Issue**: "DSN not provided" or similar error

**Solutions**:
1. Make sure `.env` file exists and contains `VITE_SENTRY_DSN`
2. Restart dev server after adding environment variables
3. Check that vite-env.d.ts includes the VITE_SENTRY_DSN type definition

## Security Notes

- ✅ The DSN is safe to expose in client-side code (it's public)
- ❌ The Auth Token is **secret** - never commit it to git
- ✅ The `.env` file is already in `.gitignore`
- ✅ Only use `.env.example` for documentation with placeholder values

## Additional Resources

- [Sentry React Documentation](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Source Maps Guide](https://docs.sentry.io/platforms/javascript/sourcemaps/)
- [Sentry Vite Plugin](https://github.com/getsentry/sentry-javascript-bundler-plugins/tree/main/packages/vite-plugin)
