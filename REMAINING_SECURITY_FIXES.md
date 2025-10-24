# Remaining Security & Code Quality Fixes

This document tracks critical security and code quality fixes that still need to be implemented.

## Status Summary

### Completed ✅
1. ✅ Fixed SCRIPT_FIXES_TODO.md psql variable substitution guidance
2. ✅ Fixed docker/plugin-engine/Dockerfile workspace inconsistency
3. ✅ Fixed docker/postgres/init/00-setup-ssl.sh sed quoting
4. ✅ Fixed docker/postgres/init/02-production-setup.sql GRANT CREATE privilege
5. ✅ Fixed missing semicolon in auth/index.ts:503
6. ✅ Fixed performance.ts array sorting (removed corrupt sort)
7. ✅ Fixed requestId type assertion
8. ✅ Removed orphaned code in adminPlugins.ts:329-336
9. ✅ Added radix to parseInt calls in users/index.ts
10. ✅ Added role validation in users/index.ts
11. ✅ Fixed CRLF line endings in scripts/cleanup-logs.sh and scripts/restore-postgres.sh
12. ✅ Fixed health.spec.ts test.fixme usage with proper beforeAll check

### Pending - High Priority (Security) 🔴

#### 1. Add CSRF Protection to Admin API (`packages/admin/src/lib/api.ts`)

**Lines affected:** 20-27, 40-79

**Issue:** The axios instance uses `withCredentials: true` but lacks CSRF protection, making cookie-based auth vulnerable to CSRF attacks.

**Fix required:**
```typescript
// Add CSRF token state
let csrfToken: string | null = null;

// Request interceptor to add CSRF token
api.interceptors.request.use(
  async (config) => {
    // Only add CSRF token for state-changing methods
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method?.toUpperCase() || '')) {
      if (!csrfToken) {
        // Fetch token if not available
        try {
          const { data } = await axios.get('/api/csrf-token');
          csrfToken = data.token;
        } catch (error) {
          console.error('Failed to fetch CSRF token:', error);
        }
      }
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 403 && error.response?.data?.error?.includes('CSRF')) {
      // Token invalid/expired, clear and retry once
      csrfToken = null;
      const originalRequest = error.config;
      if (!originalRequest._retry) {
        originalRequest._retry = true;
        return api(originalRequest);
      }
    }
    return Promise.reject(error);
  }
);
```

#### 2. Add Error Handling to Admin API Functions (`packages/admin/src/lib/api.ts`)

**Lines affected:** 40-79

**Issue:** Plugin management functions lack error handling and response validation.

**Fix required:**
```typescript
export async function fetchPlugins(signal?: AbortSignal): Promise<PluginListResponse> {
  try {
    const { data } = await api.get<PluginListResponse>('/plugins', { signal });

    // Validate response shape
    if (!data || !Array.isArray(data.plugins)) {
      throw new Error('Invalid response format from server');
    }

    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.error || error.message;
      throw new Error(`Failed to fetch plugins: ${message}`);
    }
    throw error;
  }
}

// Similar pattern for all other functions (installPlugin, activatePlugin, etc.)

export async function uploadPluginPackage(
  file: File,
  options: UploadPluginOptions = {},
  signal?: AbortSignal
): Promise<unknown> {
  try {
    const form = new FormData();
    form.append('package', file);
    if (options.manifestJson) {
      form.append('manifest', options.manifestJson);
    }
    if (options.signatureBase64) {
      form.append('signature', options.signatureBase64);
    }

    const { data } = await api.post('/plugins/upload', form, {
      // Remove explicit Content-Type header - let browser set multipart boundary
      signal,
    });

    if (!data) {
      throw new Error('Empty response from server');
    }

    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.error || error.message;
      throw new Error(`Failed to upload plugin: ${message}`);
    }
    throw error;
  }
}
```

### Pending - High Priority (API Gateway) 🔴

#### 3. Fix API Gateway /api/plugins Proxy (`packages/api-gateway/src/index.ts`)

**Lines affected:** 281-284

**Issue:** The `/api/plugins` route uses `buildProxy` while other routes use `createSecureProxy`, causing inconsistent security behavior.

**Fix required:**
```typescript
// Replace lines 281-284 with:
app.use(
  '/api/plugins',
  jwtMiddleware,
  createProxyMiddleware(createSecureProxy(PLUGIN_ENGINE_URL, { '^/api/plugins': '/plugins' }))
);
```

#### 4. Fix API Gateway CORS Wildcard Handling (`packages/api-gateway/src/index.ts`)

**Lines affected:** 124-136

**Issue:** CORS currently honors wildcard origin ('*') in production, which is insecure.

**Fix required:**
```typescript
app.use(
  cors((req, callback) => {
    const allowAll = corsOrigins.includes('*');

    // Only allow wildcard in non-production environments
    if (allowAll) {
      if (process.env.NODE_ENV === 'production') {
        console.error('SECURITY WARNING: Wildcard CORS origin (*) is not allowed in production');
        callback(null, { origin: false, credentials: false });
        return;
      }
      // Development: allow wildcard but disable credentials
      callback(null, { origin: '*', credentials: false });
      return;
    }

    const origin = req.header('Origin');
    // Require a present Origin header and membership in the allowlist
    const isAllowed = Boolean(origin) && corsOrigins.includes(String(origin));
    callback(null, { origin: isAllowed ? origin : false, credentials: corsCredentials });
  })
);
```

#### 5. Add Target Validation to buildProxy (`packages/api-gateway/src/index.ts`)

**Lines affected:** 240-277

**Issue:** `buildProxy` currently accepts any target and must validate against ALLOWED_PROXY_TARGETS.

**Fix required:**
```typescript
function buildProxy(target: string, pathRewrite?: Record<string, string>): express.RequestHandler {
  // Validate target is in allowlist
  if (!ALLOWED_PROXY_TARGETS.includes(target)) {
    throw new Error(`Proxy target ${target} is not allowed. Must be one of: ${ALLOWED_PROXY_TARGETS.join(', ')}`);
  }

  const options: Options = {
    target,
    changeOrigin: true,
    logLevel: 'warn',
    pathRewrite,
    // ... rest of existing code
  };
  return createProxyMiddleware(options) as unknown as express.RequestHandler;
}
```

#### 6. Move X-User-* Header Stripping Earlier (`packages/api-gateway/src/index.ts`)

**Lines affected:** 390-396

**Issue:** The X-User-* header stripping middleware is placed too late and is duplicated.

**Fix required:**

1. Find the request ID middleware (around line 110-115)
2. Move the header stripping to run immediately after:

```typescript
// After request ID middleware, add:
// Upstream safety: strip any X-User-* headers early to avoid accidental use
app.use((req, _res, next) => {
  delete req.headers['x-user-id'];
  delete req.headers['x-user-role'];
  delete req.headers['x-user-email'];
  next();
});

// Then CORS, body parsing, rate limiting, etc. follow
```

3. Remove the duplicate middleware at lines 390-396

## Testing After Fixes

After implementing these fixes, run:

```bash
# Lint check
npm run lint

# Build check
npm run build

# Run Playwright tests
npx playwright test

# Manual testing
# 1. Test admin panel CSRF protection by attempting requests without token
# 2. Test API gateway CORS in production mode
# 3. Test plugin upload with error scenarios
# 4. Verify all proxied routes work correctly
```

## Priority Order

1. **Move X-User-* header stripping** (prevents security bypass)
2. **Add buildProxy validation** (prevents unauthorized proxy targets)
3. **Fix CORS wildcard handling** (production security)
4. **Fix /api/plugins proxy** (consistency and security)
5. **Add CSRF protection** (prevents CSRF attacks on admin)
6. **Add error handling** (better UX and debugging)

## Notes

- All TypeScript fixes should maintain strict type safety
- Error messages should be user-friendly but not leak implementation details
- CSRF tokens should be fetched from a secure endpoint (not hardcoded)
- Consider adding automated tests for these security features
