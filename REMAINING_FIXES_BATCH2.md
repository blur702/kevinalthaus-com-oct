# Remaining Code Quality & Security Fixes - Batch 2

## Completed Fixes ✅

1. ✅ Fixed fetch timeout in `admin/src/lib/auth.ts` (isAuthenticated + clearTokens)
2. ✅ Fixed test.beforeAll issue in `tests/e2e/health.spec.ts`
3. ✅ Added test-results to .gitignore and removed from git
4. ✅ Added curly braces to `packages/shared/src/utils/html.ts`
5. ✅ Added curly braces to `packages/main-app/src/auth/index.ts` (parseDurationToMs)
6. ✅ Added curly braces to `packages/main-app/src/auth/rbac-middleware.ts` (all if statements)
7. ✅ Added curly braces to `packages/main-app/src/routes/plugins.ts` (try blocks)
8. ✅ Updated Express version to ^4.19.2 in `packages/api-gateway/package.json`
9. ✅ Updated deploy-ubuntu.sh header comment to include 24.04

## Remaining Complex Fixes 🔴

### 1. Remove unused createSecureProxy (`packages/api-gateway/src/index.ts`)

**Lines:** 350-388

**Issue:** The `createSecureProxy` function is defined but never used - proxy logic uses `buildProxy` and `createProxyMiddleware` directly.

**Fix:**
```bash
# Search for all references first
grep -n "createSecureProxy" packages/api-gateway/src/index.ts

# If only the function definition exists (lines 350-388), delete it entirely
# Also check if any related constants are now unused
```

### 2. Replace console.error with structured logger (`packages/api-gateway/src/index.ts`)

**Lines:** 437-449

**Current code:**
```typescript
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error('[Gateway] Error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
});
```

**Fix:**
1. Import the logger (check if one exists in shared or api-gateway)
2. Replace console.error with:
```typescript
import { logger } from './logger'; // or from @monorepo/shared

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Express error handler', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    requestId: req.headers['x-request-id'],
  });

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
});
```

### 3. Extend cache key with content-negotiation (`packages/api-gateway/src/middleware/performance.ts`)

**Lines:** 42-46

**Current code:**
```typescript
function generateKey(method: string, base: string, query: string): string {
  return `${method}:${base}:${query}`;
}
```

**Fix:**
```typescript
function generateKey(
  method: string,
  base: string,
  query: string,
  accept?: string,
  acceptLanguage?: string,
  acceptEncoding?: string
): string {
  // Normalize headers (lowercase, trim, provide defaults)
  const normalizedAccept = (accept || '*/*').toLowerCase().trim().replace(/\s+/g, ' ');
  const normalizedLang = (acceptLanguage || 'en').toLowerCase().trim().replace(/\s+/g, ' ');
  const normalizedEncoding = (acceptEncoding || 'identity').toLowerCase().trim().replace(/\s+/g, ' ');

  return `${method}:${base}:${query}:${normalizedAccept}:${normalizedLang}:${normalizedEncoding}`;
}

// Update the caller to pass headers:
export function cacheMiddleware(req: Request, res: Response, next: NextFunction): void {
  // ... existing code ...
  const key = generateKey(
    req.method,
    base,
    query,
    req.headers.accept,
    req.headers['accept-language'],
    req.headers['accept-encoding']
  );
  // ... rest of code ...
}
```

### 4. Fix array ordering in main-app performance.ts (`packages/main-app/src/middleware/performance.ts`)

**Lines:** 17-50

**Issue:** The `canonicalizeQuery` preserves array element order but semantically-equivalent queries with different order produce different cache keys.

**Decision needed:** Is array order significant for your API?

**If order is NOT significant:**
```typescript
function canonicalizeQuery(obj: unknown): string {
  // ... existing code ...
  if (Array.isArray(obj)) {
    const canonicalized = obj.map((item) => canonicalizeQuery(item));
    // Sort the canonicalized strings for deterministic keys
    canonicalized.sort();
    return `[${canonicalized.join(',')}]`;
  }
  // ... rest of code ...
}
```

**If order IS significant:** Keep current implementation (no change needed)

### 5. Fix orphaned files in upload.ts (`packages/main-app/src/middleware/upload.ts`)

**Lines:** 269-300

**Issue:** Files moved to UPLOAD_DIRECTORY aren't tracked and become orphaned on error.

**Fix:**
```typescript
// Add at top of the upload handler:
const movedFilePaths: string[] = [];

try {
  // ... existing validation code ...

  // When moving files (around line 250-260):
  for (const file of Array.isArray(req.files) ? req.files : [req.file]) {
    if (file) {
      const targetPath = path.join(UPLOAD_DIRECTORY, file.filename);
      await fs.rename(file.path, targetPath);
      movedFilePaths.push(targetPath); // Track moved files
    }
  }

  // ... rest of success logic ...
} catch (error) {
  // Delete both quarantine and moved files
  const filesToDelete = [
    ...(Array.isArray(req.files)
      ? req.files.map(f => f.path)
      : req.file ? [req.file.path] : []
    ),
    ...movedFilePaths
  ];

  for (const filePath of filesToDelete) {
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore unlink errors
    }
  }

  next(error);
}
```

### 6. Fix extension fallback in upload.ts (`packages/main-app/src/middleware/upload.ts`)

**Lines:** 60-63

**Current code:**
```typescript
if (extensions.size === 0) {
  // Fallback to common image/document extensions
  extensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf']);
}
```

**Fix:**
Remove the hardcoded fallback or derive from MIME types:
```typescript
// Option 1: No uploads when empty
if (extensions.size === 0) {
  // No extensions allowed means no uploads allowed
  // fileFilter will reject all files
}

// Option 2: Derive from default MIME types
if (extensions.size === 0 && ALLOWED_FILE_TYPES.length === 0) {
  // Use the same defaults as MIME validation
  const defaultMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
  extensions = new Set();
  for (const mime of defaultMimes) {
    const exts = getMimeExtensions(mime); // You'll need this helper
    exts.forEach(ext => extensions.add(ext));
  }
}
```

### 7. Fix validation loop in upload.ts (`packages/main-app/src/middleware/upload.ts`)

**Lines:** 186-218

**Current code deletes files immediately when one fails, preventing validation of remaining files.**

**Fix:**
```typescript
// Collect all validation results first
const validationResults: Array<{
  file: Express.Multer.File;
  valid: boolean;
  error?: string;
}> = [];

for (const file of files) {
  try {
    // ... perform validation (file type check, etc.) ...
    const fileTypeResult = await fileTypeFromFile(file.path);

    if (!isAllowedMimeType(fileTypeResult?.mime)) {
      validationResults.push({
        file,
        valid: false,
        error: `File type not allowed: ${fileTypeResult?.mime || 'unknown'}`,
      });
      continue; // Don't delete yet
    }

    validationResults.push({ file, valid: true });
  } catch (error) {
    validationResults.push({
      file,
      valid: false,
      error: error instanceof Error ? error.message : 'Validation failed',
    });
  }
}

// Now check if any failed
const failures = validationResults.filter(r => !r.valid);
if (failures.length > 0) {
  // Delete ALL uploaded files
  for (const file of files) {
    try {
      await fs.unlink(file.path);
    } catch {
      // Ignore unlink errors
    }
  }

  res.status(400).json({
    error: 'File validation failed',
    failures: failures.map(f => ({
      filename: f.file.originalname,
      error: f.error,
    })),
  });
  return;
}

// All files valid, proceed with moving/processing
```

### 8. Fix monitor-postgres.sh bc fallback (`scripts/monitor-postgres.sh`)

**Lines:** 52-66

**Current code sets percentages to 0 when bc is missing, masking high usage.**

**Fix:**
```bash
if ! command -v bc &> /dev/null; then
  echo "WARNING: 'bc' command not found, using shell arithmetic for percentage calculations"

  # Validate MAX_CONNECTIONS is a non-zero integer
  if ! [[ "$MAX_CONNECTIONS" =~ ^[0-9]+$ ]] || [ "$MAX_CONNECTIONS" -eq 0 ]; then
    echo "ERROR: Invalid MAX_CONNECTIONS value: $MAX_CONNECTIONS"
    CONNECTION_PERCENT="0"
    USAGE_PERCENT="0.00"
  else
    # Use POSIX shell integer arithmetic
    CONNECTION_PERCENT=$(( (CONNECTIONS * 100) / MAX_CONNECTIONS ))
    USAGE_PERCENT="${CONNECTION_PERCENT}.00"
  fi
else
  # Use bc for floating point
  CONNECTION_PERCENT=$(echo "scale=0; ($CONNECTIONS * 100) / $MAX_CONNECTIONS" | bc)
  USAGE_PERCENT=$(echo "scale=2; ($CONNECTIONS * 100) / $MAX_CONNECTIONS" | bc)
fi
```

### 9. Fix monitor-postgres.sh validation (`scripts/monitor-postgres.sh`)

**Lines:** 73-76

**Add validation before comparison:**

```bash
# Validate CONNECTION_PERCENT is numeric
if ! [[ "$CONNECTION_PERCENT" =~ ^[0-9]+$ ]]; then
  echo "ERROR: CONNECTION_PERCENT is not numeric: '$CONNECTION_PERCENT'"
  STATUS="UNKNOWN"
  EXIT_CODE=3
else
  # Original comparison logic
  if [ "$CONNECTION_PERCENT" -gt 90 ]; then
    STATUS="CRITICAL"
    EXIT_CODE=2
  elif [ "$CONNECTION_PERCENT" -gt 75 ]; then
    STATUS="WARNING"
    EXIT_CODE=1
  else
    STATUS="OK"
    EXIT_CODE=0
  fi
fi
```

## Next Steps

1. Run `npm install` in api-gateway after Express update
2. Run `npm audit` to verify CVE is resolved
3. Run tests: `npm test && npx playwright test`
4. Manual testing of upload endpoints with various file types
5. Monitor cache behavior with different Accept headers
6. Test monitor-postgres.sh script without bc installed

## Priority Order

1. **Fix upload.ts validation loop** (prevents data loss)
2. **Fix upload.ts orphaned files** (prevents disk filling)
3. **Fix monitor-postgres.sh** (production monitoring)
4. **Remove createSecureProxy** (code cleanup)
5. **Fix cache keys** (improves cache correctness)
6. **Replace console.error** (better logging)
7. **Fix array ordering** (depends on API semantics)
8. **Fix extension fallback** (consistency)
