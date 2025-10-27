# Remaining CodeRabbit Fixes

## High Priority (Security/Runtime)

### 1. Upload.ts - Sanitize Error Messages (Lines 238, 260)
**File**: `packages/main-app/src/middleware/upload.ts`
**Issue**: Internal filesystem paths leaked in error messages
**Fix**:
```typescript
// Line 238 area - replace:
throw new Error(`Failed to move file to quarantine: ${renameErr.message}. Path: ${quarantinePath}`);
// with:
logger.error('Failed to move file to quarantine', renameErr, {
  filename: path.basename(file.originalFilename || 'unknown'),
  quarantinePath
});
throw new Error('Failed to move uploaded file to quarantine');

// Line 260 area - similar pattern
logger.error('Failed to move file to final destination', fallbackErr, {
  filename: path.basename(file.originalFilename || 'unknown'),
  finalPath
});
throw new Error('Failed to move uploaded file');
```

### 2. Validation.ts - Use semver Package
**File**: `packages/shared/src/security/validation.ts`
**Issue**: Custom regex for semver is complex and error-prone
**Fix**:
```typescript
// Add to package.json dependencies:
"semver": "^7.5.4"

// In validation.ts, replace regex check (lines 61-65) with:
import semver from 'semver';

export function isValidSemver(version: string): boolean {
  if (!version || typeof version !== 'string' || version.length > 100) {
    return false;
  }
  return semver.valid(version) !== null;
}
```

## Medium Priority (Functionality)

### 3. API Gateway - jwtMiddleware Reference Order
**File**: `packages/api-gateway/src/index.ts`
**Issue**: jwtMiddleware referenced before definition (lines 313-317)
**Fix**: Move getCookie (lines 320-342) and jwtMiddleware (lines 345-406) to BEFORE line 313

### 4. Plugin Management - Activation Button
**File**: `packages/main-app/src/components/PluginManagement.tsx`
**Issue**: 'installed' plugins can't be activated (lines 188-207)
**Fix**: Change condition from:
```typescript
{plugin.status === 'inactive' && (
```
to:
```typescript
{(plugin.status === 'inactive' || plugin.status === 'installed') && (
```

### 5. Admin Vite Config - Conditional SSL
**File**: `packages/admin/vite.config.ts`
**Issue**: secure: false hardcoded (lines 17-26)
**Fix**:
```typescript
const disableSSL = process.env.NODE_ENV !== 'production';

export default defineConfig({
  // ...
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ...(disableSSL ? { secure: false } : {}) // Only disable in dev
      }
    }
  }
});
```

### 6. Frontend Vite Config - Conditional SSL
**File**: `packages/frontend/vite.config.ts`
**Issue**: Same as admin (lines 19-25)
**Fix**: Same pattern as #5

## Low Priority (Operational)

### 7. Monitor Script - stderr Output
**File**: `scripts/monitor-postgres.sh`
**Issue**: Error writes to stdout (lines 10-14)
**Fix**: Change `echo "ERROR:..."` to `echo "ERROR:..." >&2`

### 8. Restore Script - Cleanup Trap ✅ RESOLVED
**File**: `scripts/restore-postgres.sh`
**Status**: Already implemented (see lines 7-19)
The script already includes a cleanup trap that restarts services if they were stopped and the script exits early.

### 9. Web Script - Production Detection ✅ RESOLVED
**File**: `scripts/web`
**Status**: Fixed in lines 284-296
**Implementation**: Comprehensive production detection using:
1. Explicit environment variables (`PRODUCTION=true` or `COMPOSE_ENV=production`)
2. Fallback to checking actually running production containers via Docker labels
3. Verifies `com.docker.compose.project` labels and `docker-compose.prod.yml` presence

The current implementation is more robust than the original suggestion, using definitive indicators instead of heuristics.

## Build & Test

After applying all fixes:
1. Run `npm run build` to verify TypeScript compilation
2. Run `npm run lint` to check for lint errors
3. Start services with `./scripts/web -on`
4. Run Playwright tests: `npx playwright test`
5. Fix any test failures
