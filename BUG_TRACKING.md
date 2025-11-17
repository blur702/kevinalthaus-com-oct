# Bug Tracking - Comprehensive Testing Session
## Session Date: 2025-11-11
## Test Credentials: kevin / [TEST_ADMIN_PASSWORD environment variable]

---

## AUTHENTICATION TEST CYCLE ISSUES

**Documentation:** See [AUTH_TEST_CYCLE_REPORT.md](./AUTH_TEST_CYCLE_REPORT.md) for detailed test cycle reports.

This section tracks bugs discovered during the iterative authentication test-fix-deploy cycle with comprehensive console monitoring.

### Authentication Test Infrastructure

**Status:** ✅ READY
**Date:** 2025-11-16
**Components:**
- Console monitoring for browser errors (JavaScript, network failures)
- Server log monitoring (API Gateway, Main App, Admin)
- Automated test execution with error aggregation
- Test cycle documentation workflow

**Test Commands:**
- `npm run test:auth:smoke` - Quick smoke tests (comp_auth.spec.ts)
- `npm run test:auth:ui` - Comprehensive UI tests (auth.spec.ts)
- `npm run test:auth:api` - API endpoint tests (api-auth.spec.ts)
- `npm run test:auth:all` - All authentication tests

**Artifacts:**
- Console errors: `test-results/console-errors.log`
- Test reports: `test-results/`
- Cycle documentation: `AUTH_TEST_CYCLE_REPORT.md`

### Discovered Issues

*Issues will be added here as they are discovered during authentication test cycles.*

**Format:**
```
### AUTH-XXX: [Brief Description]
- **Status:** OPEN | IN_PROGRESS | FIXED | VERIFIED
- **Priority:** CRITICAL | HIGH | MEDIUM | LOW
- **Discovered:** Test Cycle #N (YYYY-MM-DD)
- **Test:** path/to/test.spec.ts:line
- **Description:** Detailed description
- **Console Errors:** Link to console-errors.log section
- **Fix:** Description of fix applied (if any)
- **Commit:** GitHub commit hash (if pushed)
```

---

## CRITICAL ISSUES

### 1. ✅ FIXED - API Gateway Proxying to Wrong Port
- **Severity**: CRITICAL - Application Breaking
- **Location**: packages/api-gateway/src/index.ts:105
- **Issue**: MAIN_APP_URL defaulted to 'http://localhost:3001' (Frontend) instead of 'http://localhost:3003' (Main App)
- **Impact**: All API requests including login returned 500 errors, making entire application unusable
- **Status**: ✅ FIXED
- **Fix Applied**: Changed `const MAIN_APP_URL = process.env.MAIN_APP_URL || 'http://localhost:3001';` to `'http://localhost:3003'`
- **Verification**: Login API tested successfully with test credentials - Returns HTTP 200 with valid access tokens

### 2. JWT_SECRET Too Short (SECURITY)
- **Severity**: HIGH - Security Risk
- **Location**: Environment configuration
- **Issue**: JWT_SECRET is only 28 characters long
- **Requirement**: Minimum 32 characters for security
- **Status**: FIXED
- **Fix Applied**: Added minimum 32-character validation in `packages/main-app/src/auth/index.ts`
  - Production enforcement: Application fails to start with secrets < 32 characters
  - Development behavior: Warning logged but allows shorter secrets for local testing
  - Documentation updated in `.env.example` with prominent security warnings
- **Generation Command**: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` or `openssl rand -hex 32`

---

## WARNINGS

### 2. Sentry Express Instrumentation
- **Severity**: MEDIUM - Monitoring
- **Location**: Main App & API Gateway startup
- **Issue**: "express is not instrumented. This is likely because you required/imported express before calling `Sentry.init()`"
- **Impact**: Error tracking may not work correctly
- **Status**: IDENTIFIED
- **Fix Required**: Move Sentry.init() before express import

### 3. HashiCorp Vault Connection Failed
- **Severity**: LOW - Optional Service
- **Location**: Secrets Service
- **Issue**: "Vault health check failed" - ECONNREFUSED
- **Impact**: Vault-based secrets not available (falls back to env vars)
- **Status**: IDENTIFIED - Non-blocking
- **Fix Required**: Start Vault service or disable Vault integration for development

---

## PLUGIN ERRORS

### 4. Comments Plugin Failed to Load
- **Severity**: LOW - Disabled Plugin
- **Location**: plugins/comments.disabled/
- **Issue**: "Cannot read properties of undefined (reading 'sequelize')"
- **Impact**: Comments functionality not available (plugin is disabled)
- **Status**: IDENTIFIED
- **Fix Required**: Fix plugin or remove from plugins directory

### 5. Example Service Plugin Missing
- **Severity**: LOW - Example Code
- **Location**: plugins/example-service-plugin/
- **Issue**: "ENOENT: no such file or directory" - package.json not found
- **Impact**: Example plugin not loaded
- **Status**: IDENTIFIED
- **Fix Required**: Remove reference or add missing package.json

---

## DEPRECATION WARNINGS

### 6. Node.js util._extend Deprecated
- **Severity**: LOW - Future Compatibility
- **Location**: Lerna/dependency code
- **Issue**: "DEP0060: The `util._extend` API is deprecated. Please use Object.assign() instead"
- **Impact**: Will break in future Node.js versions
- **Status**: IDENTIFIED
- **Fix Required**: Update dependencies or wait for Lerna update

---

## CODERABBIT ISSUES

### 7. CodeRabbit Review Failures
- **Severity**: N/A - External Tool
- **Issue**: CodeRabbit CLI failing with "Unknown error" for multiple review types
- **Attempts**:
  - `--type uncommitted`: Failed - "No files found for review"
  - `--type all`: Failed - "Unknown error"
  - `--type committed`: Failed - "Unknown error"
- **Status**: BLOCKED
- **Notes**: May be authentication or API issue with CodeRabbit service

---

## PLAYWRIGHT TEST RESULTS

### Test Suite Status
- **Status**: RUNNING (as of 00:05 EST)
- **Tests Executed**: TBD
- **Passed**: TBD
- **Failed**: TBD
- **Flaky**: TBD

### Test Results
*Results will be populated when tests complete*

---

## SERVERS SUCCESSFULLY RUNNING

✅ Admin Panel: http://localhost:3002
✅ Frontend: http://localhost:3001
✅ API Gateway: Port 3000
✅ Main App: Port 3003
✅ Plugin Engine: Port 3004
✅ Database: PostgreSQL + Redis connected
✅ Migrations: All completed successfully
✅ Services Initialized:
  - Redis Rate Limiter
  - Vault Secrets Service (with fallback)
  - Email Service
  - Settings Cache
  - Blog Service
  - Editor Service
  - Taxonomy Service
  - Storage Service

---

## MANUAL TESTING COMPLETED

### Phase 1: Authentication & Access ✅
- [x] Login with test credentials - **PASSED** - HTTP 200, tokens issued correctly
- [x] Verify authentication flow - **PASSED** - accessToken and refreshToken set as HttpOnly cookies
- [x] Test API authentication - **PASSED** - Protected endpoints work with cookies

### Phase 2: API Testing ✅
- [x] Login API: `/api/auth/login` - **PASSED** - Returns user object and tokens
- [x] Dashboard Stats API: `/api/dashboard/stats` - **PASSED** - Returns correct statistics (500 users, 165 views, 37 articles)
- [x] User Management API: `/api/users-manager` - **PASSED** - Lists 503 users with pagination
- [x] Blog List API: `/api/blog` - **PASSED** - Returns 37 posts with complete metadata
- [x] Health Check API: `/health` - **PASSED** - Shows mainApp healthy, pythonService unavailable (expected)

### Phase 3: Frontend/Public ✅
- [x] Admin Panel: http://localhost:3002 - **PASSED** - Returns HTTP 200
- [x] Public Frontend: http://localhost:3001 - **PASSED** - Returns HTTP 200

### Phase 4: Functionality Verified ✅
- [x] CORS configuration working correctly
- [x] JWT token generation and validation
- [x] Database connectivity (PostgreSQL + Redis)
- [x] All services initialized successfully
- [x] Request logging and metrics working
- [x] Security headers applied correctly

---

## SESSION TEST RESULTS

### API Response Times
- Login: ~87ms response time ✅
- Dashboard stats: <20ms response time ✅
- User list: <10ms response time ✅
- Blog list: <10ms response time ✅

### Database Performance
- All queries executing in 0-1ms ✅
- 23 migrations completed successfully ✅
- Connection pooling working ✅

### Real User Activity Observed
During testing, observed actual user activity in server logs:
- Multiple successful logins via admin panel
- Dashboard loads with stats
- User management page accessed
- Settings page accessed
- All requests processing successfully

---

## BUGS FOUND & STATUS

### 1. ✅ FIXED - Critical API Gateway Bug
- **Issue**: API Gateway proxying to wrong port (3001 instead of 3003)
- **Impact**: Complete application failure - all APIs returned 500
- **Fix**: Changed MAIN_APP_URL default from port 3001 to 3003
- **Status**: FIXED & VERIFIED

### 2. ⚠️ Public Blog Endpoint Authentication Issue
- **Issue**: `/api/blog/public` requires authentication when it shouldn't be public
- **Impact**: Public blog posts not accessible without login
- **Status**: NEEDS INVESTIGATION
- **Priority**: MEDIUM

### 3. 🐛 UUID Validation in User Manager Sub-Resource Endpoints
- **Severity**: MEDIUM - Poor Error Handling
- **Location**: packages/main-app/src/routes/usersManager.ts
- **Issue**: Missing UUID format validation in sub-resource endpoints
- **Impact**: Returns generic 500 error instead of 400 Bad Request for invalid UUIDs
- **Database Error**: `invalid input syntax for type uuid: "undefined"`, `invalid input syntax for type uuid: "some-id"`
- **Status**: FIXED
- **Note**: Main endpoints (GET/PATCH/DELETE `/:id`) already had validation implemented
- **Fixed Endpoints**:
  - GET `/api/users-manager/:id/activity` - Now validates UUID before querying audit logs
  - GET `/api/users-manager/:id/custom-fields` - Now validates UUID before querying custom fields
  - PATCH `/api/users-manager/:id/custom-fields` - Now validates UUID before updating custom fields
- **Fix Applied**: Added `isValidUUID()` validation to all three sub-resource endpoints
- **Verification**: All user manager endpoints now return 400 Bad Request for invalid UUID format instead of 500 Internal Server Error

### 4. 🐛 JSON Parsing Error Handling
- **Severity**: LOW - Client Error
- **Location**: Body parser middleware
- **Issue**: Invalid JSON sent to API: `"invalid json{{{"`
- **Impact**: Returns 400 with proper error (working as expected)
- **Status**: OBSERVED - No fix needed (proper error handling)

---

## FIXES APPLIED THIS SESSION

1. **API Gateway Proxy Configuration** (packages/api-gateway/src/index.ts:105)
   - **Before**: `const MAIN_APP_URL = process.env.MAIN_APP_URL || 'http://localhost:3001';`
   - **After**: `const MAIN_APP_URL = process.env.MAIN_APP_URL || 'http://localhost:3003';`
   - **Result**: All APIs now working correctly ✅

---

## FINAL STATUS

**Overall Status**: ✅ **APPLICATION FUNCTIONAL**
**Critical Bug Fixed**: YES ✅
**Core APIs Working**: YES ✅
**Authentication Working**: YES ✅
**Database Working**: YES ✅
**Frontends Accessible**: YES ✅

**Remaining Issues**:
- JWT_SECRET security (needs lengthening) - HIGH PRIORITY
- UUID validation in user manager endpoints - MEDIUM PRIORITY
- Public blog endpoint authentication - MEDIUM PRIORITY
- Sentry instrumentation warning - LOW PRIORITY
- Vault connection (optional) - LOW PRIORITY
- Disabled plugins cleanup - LOW PRIORITY

**Test Summary**:
- ✅ Critical bug fixed (API Gateway proxy)
- ✅ Authentication working (login, tokens, CORS)
- ✅ All core APIs tested and functional
- ✅ Database performance excellent (<1ms queries)
- ✅ Frontend applications accessible
- 🐛 3 additional bugs identified for future fixes

---

## Notes for Improvement

1. Need better error handling for plugin loading
2. Consider making Vault optional for development
3. Add healthcheck validation in startup process
4. Improve JWT secret generation documentation
5. Clean up disabled/example plugins from production builds
