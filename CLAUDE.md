# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a microservices-based web platform built with Node.js 20+, TypeScript, React, and PostgreSQL 16. The architecture emphasizes security (RBAC, JWT auth, CSRF protection), extensibility (plugin system), and scalability (independent service scaling).

**Key characteristics:**
- Lerna monorepo with workspace packages in `packages/*` and `plugins/*`
- JWT-based authentication with httpOnly cookies and refresh token rotation
- Defense-in-depth security: helmet, CORS allowlists, CSRF tokens, timing-safe comparisons
- Plugin system with isolated PostgreSQL schemas (`plugin_<name>`) and capability-based permissions
- All internal services communicate through the API Gateway in production

## Essential Commands

### Development
```bash
# Install and build
npm install                    # Install all workspace dependencies
npm run build                  # Build all packages (TypeScript compilation)

# Development servers
npm run dev                    # Start all services in parallel (via Lerna)
cd packages/main-app && npm run dev    # Start single service
./scripts/web -on              # Start full stack including Docker services

# Code quality
npm run lint                   # ESLint across all packages
npm run format                 # Prettier formatting

# Testing
cd packages/main-app && npm test       # Run tests for specific package
cd packages/main-app && npm run test:watch  # Watch mode
```

### Docker Operations
```bash
# Development
docker compose up -d postgres redis    # Start infrastructure only
docker compose up -d                   # Start all services

# Production
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Helpers
./scripts/web -off             # Stop all services
./scripts/backup-postgres.sh   # Backup database
./scripts/restore-postgres.sh  # Restore database
```

### Database Migrations
Migrations run automatically on application startup in `packages/main-app/src/db/migrations.ts`. They use PostgreSQL advisory locks to prevent concurrent execution and are tracked in the `migrations` table.

## Architecture

### Service Communication Flow
```
Client → API Gateway (:3000 dev / :4000 prod)
           ↓
           ├─→ Main App (:3001, internal) → PostgreSQL, Redis
           ├─→ Python Service (:8000, internal)
           └─→ Plugin Engine (:3004, internal)

Frontend (:3002) / Admin (:3003) → API Gateway
```

**Critical:** In production, only API Gateway, Frontend, and Admin are exposed to the host. All backend services (Main App, Python Service, Plugin Engine, PostgreSQL, Redis) are accessible only within the Docker network `app_network`.

### Authentication & Authorization

1. **JWT Flow:**
   - Access tokens: 15 min expiry, stored in `accessToken` httpOnly cookie
   - Refresh tokens: 30 days expiry, stored in `refreshToken` httpOnly cookie, hashed in DB
   - Token validation in API Gateway → forwards user context to internal services

2. **RBAC Implementation:**
   - Roles: `admin`, `editor`, `viewer` (defined in `packages/shared/src/types/roles.ts`)
   - Capabilities: fine-grained permissions (e.g., `USER_VIEW`, `USER_EDIT`)
   - Middleware: `requireRole()`, `requireCapability()` in `packages/main-app/src/auth/rbac-middleware.ts`

3. **CSRF Protection:**
   - Admin routes require CSRF token (double-submit cookie pattern)
   - Validated in `packages/main-app/src/routes/adminPlugins.ts`
   - Secret stored separately from session secret (`CSRF_SECRET` vs `SESSION_SECRET`)

### Shared Package (`packages/shared`)

This is the **core shared library** imported by all services. Key exports:

- **Types:** `Role`, `Capability`, `PluginManifest`, Express type augmentations
- **Security:** `hashPassword()`, `verifyPassword()`, `hashSHA256()`, `sanitizeFilename()`, `stripHTML()`
- **Database:** `QueryIsolationEnforcer` (SQL complexity analysis, row limits)
- **Plugin:** `validatePluginManifest()`, `parsePluginYAML()`
- **Middleware:** `generateRequestId()`, logging utilities

When adding utilities that multiple services need, add them to `packages/shared/src/` and export via `index.ts`.

### Database Schema

**Core tables (managed by main-app migrations):**
- `users` - User accounts with RBAC roles
- `refresh_tokens` - JWT refresh tokens (hashed)
- `migrations` - Migration tracking
- `audit_log` - Security/audit trail (optional)

**Plugin isolation:**
- Each plugin gets a dedicated schema: `plugin_<name>`
- Plugins cannot access other plugins' schemas or core tables without explicit capability grants
- Enforced via `QueryIsolationEnforcer` in `packages/shared/src/database/isolation.ts`

### Environment Variables

**Critical secrets (MUST be set):**
- `JWT_SECRET` - JWT signing key (generate with `./scripts/ensure-jwt-secret.sh`)
- `POSTGRES_PASSWORD` - Database password
- `CSRF_SECRET` - CSRF token signing key (auto-generated in dev)

**Service URLs (for local dev):**
```
MAIN_APP_URL=http://localhost:3001
PYTHON_SERVICE_URL=http://localhost:8000
PLUGIN_ENGINE_URL=http://localhost:3004
```

**In production Docker:** Services use container names (e.g., `http://main-app:3001`)

## Plugin System

Plugins are defined in `plugins/*/plugin.yaml` manifests and loaded by the Plugin Engine.

**Structure:**
```
plugins/my-plugin/
  plugin.yaml          # Manifest (name, version, capabilities, entrypoints)
  src/index.ts         # Backend handler
  frontend/            # Optional React components
  migrations/          # Database migrations for plugin schema
```

**Manifest example:**
```yaml
name: my-plugin
version: 1.0.0
capabilities:
  - database:read     # Request specific capabilities
  - database:write
entrypoint: dist/index.js
```

**Execution context:**
```typescript
import type { PluginExecutionContext } from '@monorepo/shared';

export async function handler(ctx: PluginExecutionContext) {
  // ctx.db - isolated database connection to plugin_my-plugin schema
  // ctx.logger - structured logger
  // ctx.config - plugin settings from DB
}
```

**Lifecycle hooks:** `onInstall`, `onActivate`, `onDeactivate`, `onUninstall`, `onUpdate`

## Security Considerations

### Input Validation
- **Always sanitize user input:** Use `stripHTML()`, `sanitizeFilename()` from `@monorepo/shared`
- **Email validation:** Use `validateEmail()` from shared package
- **SQL injection:** All queries use parameterized queries (`query($1, $2)` syntax)
- **File uploads:** Validated in `packages/main-app/src/middleware/upload.ts` (type, size, magic bytes)

### Timing Attack Prevention
- Password comparison: `verifyPassword()` uses bcrypt (constant-time)
- Login flow: Always call `verifyPassword()` even for non-existent users (dummy hash)
- Implementation in `packages/main-app/src/auth/index.ts` around line 161-262

### CORS Configuration
- Allowlist managed via `CORS_ALLOWED_ORIGINS` environment variable
- Parsed in `packages/main-app/src/middleware/cors.ts`
- Default in development: `http://localhost:3002,http://localhost:3003`

### Secrets Management
- **Never commit secrets** - Use `.env` (gitignored)
- **JWT_SECRET:** Persisted by `./scripts/ensure-jwt-secret.sh`
- **Production SSL:** Certificates in `./secrets/` (gitignored), mounted into Postgres container

## Code Quality Standards

### TypeScript Configuration
- Strict mode enabled across all packages
- No implicit `any` - all types must be explicit
- `@typescript-eslint` with security plugin enabled

### Common Linting Fixes
When adding new code:
1. **Async handlers in Express:** Use `async (req, res): Promise<void> =>` and add `// eslint-disable-next-line @typescript-eslint/no-misused-promises` above route definitions
2. **Console statements:** Add `// eslint-disable-next-line no-console` for intentional logging
3. **Type assertions:** Minimize `as` casts; prefer type guards
4. **Query parameter handling:** Express `req.query` types are `ParsedQs`, convert to string with `String(value)`

### Testing
Tests use Jest. Example structure:
```typescript
// packages/main-app/src/__tests__/app.test.ts
describe('Health endpoint', () => {
  it('should return 200 OK', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });
});
```

## Common Patterns

### Adding a New API Endpoint
1. Create route handler in `packages/main-app/src/routes/`
2. Add authentication: `router.use(authMiddleware)`
3. Add authorization: `requireRole(Role.ADMIN)` or `requireCapability(Capability.X)`
4. Register in `packages/main-app/src/server.ts`
5. Update API Gateway proxy in `packages/api-gateway/src/index.ts` if needed

### Database Queries
```typescript
import { query, transaction } from '../db';

// Simple query
const result = await query<{ id: string; email: string }>(
  'SELECT id, email FROM users WHERE id = $1',
  [userId]
);

// Transaction
await transaction(async (client) => {
  await client.query('INSERT INTO users ...', [...]);
  await client.query('INSERT INTO audit_log ...', [...]);
});
```

Query logging is automatically handled with sampling (every 10th query in production, all in debug mode).

### Adding Shared Utilities
1. Add to appropriate file in `packages/shared/src/`
2. Export from `packages/shared/src/index.ts`
3. Import in consuming package: `import { myUtil } from '@monorepo/shared'`
4. Run `npm run build` to rebuild shared package

## Troubleshooting

### "JWT_SECRET is required"
Run `./scripts/ensure-jwt-secret.sh` to generate and persist a secret.

### PostgreSQL connection refused
Ensure Postgres is running: `docker compose up -d postgres`
Check logs: `docker compose logs postgres`

### Port already in use
Use `./scripts/web -off` to stop all services, or manually:
```bash
docker compose down
# Kill any lingering Node processes
pkill -f "node.*3000|3001|3002|3003"
```

### Linting errors after git pull
```bash
npm install          # Update dependencies
npm run build        # Rebuild TypeScript
npm run lint         # Check for errors
```

### Plugin not loading
1. Verify `plugin.yaml` is valid YAML and matches schema
2. Check Plugin Engine logs: `docker compose logs plugin-engine`
3. Ensure capabilities are granted in admin UI

## Documentation Links

For comprehensive details, see:
- `docs/getting-started.md` - Setup and installation
- `docs/architecture.md` - System design and services
- `docs/security.md` - Security model and best practices
- `docs/plugins.md` - Plugin development guide
- `docs/deployment.md` - Production deployment
- `docs/api.md` - API reference

## CodeRabbit CLI Integration

This repository supports CodeRabbit CLI for local AI-powered code reviews in WSL, complementing the existing web-based CodeRabbit integration (tracked in `CODERABBIT_FIXES.md`).

**Key capabilities:**
- **Local-first workflow:** Review code before pushing to GitHub
- **AI-friendly output:** `--prompt-only` flag produces token-efficient, structured feedback optimized for Claude Code
- **Uncommitted changes:** Review work-in-progress code that hasn't been committed
- **Automated fixes:** Claude can parse CodeRabbit output and apply fixes automatically

**Quick setup:**
```bash
# Install in WSL
curl -fsSL https://cli.coderabbit.ai/install.sh | sh
source ~/.bashrc

# Authenticate (do this both standalone and within Claude Code sessions)
coderabbit auth login

# Test review
coderabbit --prompt-only --type uncommitted
```

**Example Claude Code workflow:**
```
"Please implement <task>, then run coderabbit --prompt-only --type uncommitted
in the background, let it take as long as it needs, and fix the issues it finds."
```

When Claude runs CodeRabbit with `--prompt-only`, the output is structured for machine parsing with file paths, line numbers, severity levels, and suggested fixes. Reviews typically take 7-30+ minutes and can run in background while continuing work.

**Common flags:**
- `--prompt-only` - AI-friendly output format (essential for Claude integration)
- `--type uncommitted` - Review only uncommitted changes (faster, focused)
- `--type staged` - Review only staged changes
- `--base main` - Review changes against specific branch

**Important notes:**
- Authentication must be done separately for standalone WSL and Claude Code sessions
- Reviews can take 7-30+ minutes; use background execution for long reviews
- Track fixes in `CODERABBIT_FIXES.md` to maintain consistency with existing process
- Configure Git line-ending settings (`git config --global core.autocrlf input` in WSL) to avoid CRLF/LF issues
- For best performance, work in WSL Linux filesystem (`~/projects/`) rather than `/mnt/c/` Windows drives

**Comprehensive setup guide:** See `docs/coderabbit-cli.md` for:
- Prerequisites verification (WSL, curl, unzip, git)
- Git configuration for line endings
- Installation and authentication (standalone + Claude Code)
- Testing integration and troubleshooting
- Best practices and operational workflows

### Autonomous Claude + CodeRabbit Workflow

The CodeRabbit CLI enables a fully autonomous iterative review-and-fix loop between Claude Code and CodeRabbit's AI reviewer. This workflow allows Claude to:

1. Implement features or fixes
2. Run CodeRabbit review automatically
3. Parse structured feedback from `--prompt-only` output
4. Apply fixes for detected issues
5. Re-run CodeRabbit to verify fixes
6. Report results to user

**How it works:**

```text
User Request
    ↓
Claude implements feature/fix
    ↓
Claude runs: coderabbit --prompt-only --type uncommitted (background)
    ↓
CodeRabbit analyzes code (7-30+ minutes)
    ↓
Claude receives structured output:
  - File paths and line numbers
  - Issue severity levels
  - Specific recommendations
  - Suggested fixes
    ↓
Claude applies fixes automatically
    ↓
Claude runs: coderabbit --prompt-only --type uncommitted (verify)
    ↓
Claude reports: issues found → fixes applied → verification status
```

**Example prompts for autonomous workflow:**

```bash
# Basic autonomous loop
"Please implement user profile editing, then run CodeRabbit review and fix any issues it finds."

# With explicit background execution
"Add password reset functionality, then run coderabbit --prompt-only --type uncommitted
in the background and fix the issues while continuing to work."

# Multi-iteration loop
"Refactor the authentication middleware, run CodeRabbit, fix issues, and re-run
until the review passes with no critical or high-severity issues."

# Focused review scope
"Update the database migration logic, then run CodeRabbit with --type staged
(review only staged changes) and fix any problems."
```

**Key advantages of `--prompt-only` for AI consumption:**

- **Structured output:** Machine-parseable format with consistent schema
- **Token efficiency:** Optimized for AI consumption, reduces token usage vs. human-readable output
- **Direct actionability:** Includes file paths, line numbers, and specific fix suggestions
- **Severity filtering:** Claude can prioritize critical/high issues first
- **Batch processing:** Claude can apply multiple fixes before re-verification

**Expected review times:**

- **Small changes (1-5 files):** 7-12 minutes
- **Medium changes (6-20 files):** 12-20 minutes
- **Large changes (20+ files):** 20-30+ minutes
- **Uncommitted vs. staged:** Uncommitted reviews are typically faster (focused scope)

**Verification cycle example:**

```text
Iteration 1:
  - CodeRabbit finds 8 issues (3 critical, 5 medium)
  - Claude fixes all 8 issues
  - Claude commits fixes or stages for re-review

Iteration 2:
  - CodeRabbit finds 2 issues (1 medium, 1 low)
  - Claude fixes remaining 2 issues
  - Claude stages for final verification

Iteration 3:
  - CodeRabbit finds 0 issues
  - Claude reports: "All issues resolved, code passes review"
```

**Best practices for autonomous workflow:**

1. **Use background execution for long reviews:** Reviews can take 7-30+ minutes, so run in background and continue working
2. **Scope reviews appropriately:** Use `--type uncommitted` for work-in-progress, `--type staged` for pre-commit verification
3. **Verify after fixes:** Always re-run CodeRabbit after applying fixes to confirm resolution
4. **Track fixes consistently:** Document fixes in `CODERABBIT_FIXES.md` to maintain audit trail
5. **Prioritize by severity:** Address critical/high-severity issues first, defer low-severity for later
6. **Batch related fixes:** Group similar fixes together for efficiency
7. **Use specific base branches:** `--base main` or `--base develop` to review against specific target branch

**Troubleshooting autonomous workflow:**

- **"No files found for review":** Check git status, verify CRLF/LF settings (`git config --global core.autocrlf input`)
- **Review takes too long:** Use `--type uncommitted` or `--type staged` to narrow scope
- **False positives:** Use judgment to skip non-actionable suggestions, document reasoning in commit message
- **Authentication expired:** Re-authenticate with `coderabbit auth login` in both standalone WSL and Claude Code sessions
- **Parsing errors:** If `--prompt-only` output is malformed, re-run review or check CLI version

**Integration with existing process:**

- **CODERABBIT_FIXES.md:** Continue tracking fixes in this file (automated + manual reviews)
- **Git workflow:** Commit fixes with descriptive messages referencing CodeRabbit review
- **CI/CD integration:** Local CLI reviews complement GitHub Actions CodeRabbit checks
- **Pre-commit hooks:** Optional integration to run CodeRabbit before allowing commits

### CodeRabbit Integration Wrapper Scripts

This repository includes a comprehensive wrapper system that solves communication issues between Claude Code and CodeRabbit CLI. The wrapper provides real-time progress updates, automatic test execution, structured status tracking, and completion notifications.

**Problem solved:**
- CodeRabbit reviews take 7-30+ minutes with no intermediate feedback
- No automatic test execution before reviews
- No structured status tracking for Claude to monitor
- No completion notifications

**Solution:**
Three integrated scripts that provide complete monitoring and automation:

#### 1. CodeRabbit Wrapper (`scripts/coderabbit-wrapper.sh`)

Main wrapper script that orchestrates the entire review workflow.

**Features:**
- Runs tests automatically before CodeRabbit review (linting + unit tests)
- Provides real-time progress updates with elapsed time counter
- Creates structured JSON status file for AI parsing
- Generates completion notification with summary
- Handles errors gracefully with proper cleanup
- Supports background execution

**Usage:**
```bash
# Full review with automatic testing
wsl bash -c "cd /mnt/e/OneDrive/Documents/kevinalthaus-com-oct && ./scripts/coderabbit-wrapper.sh"

# Review without running tests
wsl bash -c "cd /mnt/e/OneDrive/Documents/kevinalthaus-com-oct && ./scripts/coderabbit-wrapper.sh --no-tests"

# Review staged changes only
wsl bash -c "cd /mnt/e/OneDrive/Documents/kevinalthaus-com-oct && ./scripts/coderabbit-wrapper.sh --type staged"

# Show help
wsl bash -c "cd /mnt/e/OneDrive/Documents/kevinalthaus-com-oct && ./scripts/coderabbit-wrapper.sh --help"
```

**Output locations:**
- Status JSON: `.coderabbit-status/status.json`
- Progress log: `.coderabbit-status/progress.log`
- Review output: `.coderabbit-status/output.txt`
- Notification: `.coderabbit-status/notification.txt`

**Status JSON structure:**
```json
{
  "status": "running_review",
  "startTime": "2025-10-28T15:03:45",
  "pid": 12345,
  "phase": "reviewing",
  "testsRun": true,
  "testsPassed": true,
  "reviewComplete": false,
  "issuesFound": null,
  "exitCode": null,
  "endTime": null
}
```

#### 2. Status Monitor (`scripts/coderabbit-status.sh`)

Check progress and monitor running reviews.

**Features:**
- Human-readable status display with colors
- JSON output mode for AI consumption
- Follow mode for real-time log tailing
- Wait mode to block until completion
- Process status checking

**Usage:**
```bash
# Show current status (human-readable)
wsl bash -c "cd /mnt/e/OneDrive/Documents/kevinalthaus-com-oct && ./scripts/coderabbit-status.sh"

# Get JSON status for AI parsing
wsl bash -c "cd /mnt/e/OneDrive/Documents/kevinalthaus-com-oct && ./scripts/coderabbit-status.sh json"

# Follow progress log in real-time
wsl bash -c "cd /mnt/e/OneDrive/Documents/kevinalthaus-com-oct && ./scripts/coderabbit-status.sh follow"

# Wait for review to complete
wsl bash -c "cd /mnt/e/OneDrive/Documents/kevinalthaus-com-oct && ./scripts/coderabbit-status.sh wait"

# Show last 50 lines of progress
wsl bash -c "cd /mnt/e/OneDrive/Documents/kevinalthaus-com-oct && ./scripts/coderabbit-status.sh tail 50"

# Show review output
wsl bash -c "cd /mnt/e/OneDrive/Documents/kevinalthaus-com-oct && ./scripts/coderabbit-status.sh output"
```

#### 3. Test Runner (`scripts/run-tests.sh`)

Standalone test runner for pre-review validation.

**Features:**
- Automatically discovers packages with tests
- Runs linting before tests
- Optional TypeScript type checking
- Detailed results per package
- Configurable flags

**Usage:**
```bash
# Run all checks (lint + tests)
wsl bash -c "cd /mnt/e/OneDrive/Documents/kevinalthaus-com-oct && ./scripts/run-tests.sh"

# Run lint only (skip tests)
wsl bash -c "cd /mnt/e/OneDrive/Documents/kevinalthaus-com-oct && ./scripts/run-tests.sh --no-tests"

# Run with type checking
wsl bash -c "cd /mnt/e/OneDrive/Documents/kevinalthaus-com-oct && ./scripts/run-tests.sh --typecheck"

# Exit on first error
wsl bash -c "cd /mnt/e/OneDrive/Documents/kevinalthaus-com-oct && ./scripts/run-tests.sh --exit-on-error"
```

#### Autonomous Workflow with Wrappers

The wrapper scripts enable a fully autonomous review loop for Claude Code:

**Recommended workflow:**
```text
1. Claude implements feature/fix
2. Claude runs: ./scripts/coderabbit-wrapper.sh (in background)
3. Claude continues working on other tasks
4. Claude periodically checks: ./scripts/coderabbit-status.sh json
5. When status.reviewComplete = true:
   - Claude reads: cat .coderabbit-status/notification.txt
   - Claude reads: cat .coderabbit-status/output.txt
   - Claude parses issues and applies fixes
   - Claude re-runs wrapper to verify fixes
6. Claude reports final results to user
```

**Example Claude Code prompts:**

```bash
# Basic autonomous workflow
"Please implement user authentication, then run the CodeRabbit wrapper script
and fix any issues it finds."

# With explicit monitoring
"Add the new API endpoint, run ./scripts/coderabbit-wrapper.sh in background,
monitor progress with the status script, and fix issues when complete."

# Multi-iteration verification
"Refactor the database layer, run CodeRabbit via the wrapper, fix all issues,
and re-run until the review passes with zero critical/high-severity issues."
```

**Checking progress during long reviews:**

```bash
# Claude can run this periodically (every 2-3 minutes)
wsl bash -c "cd /mnt/e/OneDrive/Documents/kevinalthaus-com-oct && ./scripts/coderabbit-status.sh json"

# Parse the JSON to check:
# - "status": current phase (running_tests, running_review, completed, failed)
# - "reviewComplete": boolean (true when review is done)
# - "issuesFound": number of issues found
# - "exitCode": final exit code (0 = success)
```

**Reading results:**

```bash
# Get completion notification
wsl bash -c "cd /mnt/e/OneDrive/Documents/kevinalthaus-com-oct && cat .coderabbit-status/notification.txt"

# Get full review output (AI-friendly format)
wsl bash -c "cd /mnt/e/OneDrive/Documents/kevinalthaus-com-oct && cat .coderabbit-status/output.txt"

# Get progress log for debugging
wsl bash -c "cd /mnt/e/OneDrive/Documents/kevinalthaus-com-oct && cat .coderabbit-status/progress.log"
```

#### Testing the Integration

Comprehensive test suites validate the wrapper scripts:

```bash
# Quick validation (~1-2 minutes)
bash scripts/test-coderabbit-simple.sh

# Comprehensive tests (~2-3 minutes)
bash scripts/test-coderabbit-integration.sh

# Syntax validation only
bash -n scripts/coderabbit-wrapper.sh && \
bash -n scripts/coderabbit-status.sh && \
bash -n scripts/run-tests.sh && \
echo "✓ All scripts syntax OK"
```

**Test coverage:**
- Script initialization and permissions
- Bash syntax validation
- Help command display
- Directory/file creation
- Error handling
- Exit codes
- Flag parsing
- Package discovery
- JSON output format

**Test results:** All 19 tests passing (100% success rate)

**Documentation:**
- `TEST_RESULTS.md` - Detailed test results with all scenarios
- `TESTING_SUMMARY.md` - Executive summary and recommendations
- `QUICK_TEST_REFERENCE.md` - Quick reference guide

#### Wrapper Script Features

**Real-time progress tracking:**
- Live elapsed time counter: `[03:45] Review in progress...`
- Phase transitions logged: `setup → testing → reviewing → notification`
- Color-coded output for visibility
- Timestamped progress log

**Automatic test execution:**
- Discovers all packages with test scripts
- Runs linting first (npm run lint)
- Runs unit tests per package
- Captures test results in status
- Continues to review even if tests fail (logs warning)

**Completion notification example:**
```
=============================================================================
                    CODERABBIT REVIEW COMPLETE
=============================================================================

Status: SUCCESS
Exit Code: 0

Timeline:
  Started:  2025-10-28T15:03:45
  Finished: 2025-10-28T15:18:22

Test Results:
  Tests Run: Yes
  Tests Passed: Yes

Review Results:
  Issues Found: 8

Output Location:
  Full output: /path/to/.coderabbit-status/output.txt
  Progress log: /path/to/.coderabbit-status/progress.log
  Status JSON: /path/to/.coderabbit-status/status.json

=============================================================================

Next Steps:
1. Review the output file: cat /path/to/.coderabbit-status/output.txt
2. Apply fixes as recommended
3. Re-run tests to verify fixes
4. Run this script again to verify all issues are resolved

=============================================================================
```

**Error handling:**
- Checks if CodeRabbit CLI is installed
- Validates Git configuration
- Handles missing dependencies gracefully
- Cleanup handlers ensure status is updated even on failure
- Clear error messages with troubleshooting guidance

#### Best Practices for Claude Code

**1. Always use the wrapper script (not raw CodeRabbit CLI)**
```bash
# ✓ GOOD - Use wrapper
wsl bash -c "cd /mnt/e/OneDrive/Documents/kevinalthaus-com-oct && ./scripts/coderabbit-wrapper.sh"

# ✗ BAD - Direct CLI call (no status tracking)
wsl bash -c "cd /mnt/e/OneDrive/Documents/kevinalthaus-com-oct && coderabbit review --prompt-only --type uncommitted"
```

**2. Monitor progress periodically**
```bash
# Check status every 2-3 minutes during long reviews
wsl bash -c "cd /mnt/e/OneDrive/Documents/kevinalthaus-com-oct && ./scripts/coderabbit-status.sh json"
```

**3. Wait for completion before applying fixes**
```bash
# Parse JSON to check reviewComplete field
status=$(wsl bash -c "cd /mnt/e/OneDrive/Documents/kevinalthaus-com-oct && ./scripts/coderabbit-status.sh json")
# When reviewComplete = true, read output and apply fixes
```

**4. Track fixes in CODERABBIT_FIXES.md**
```bash
# After applying fixes, document them
echo "### Fix Applied: $(date)" >> CODERABBIT_FIXES.md
echo "- Issue: <description>" >> CODERABBIT_FIXES.md
echo "- File: <file>:<line>" >> CODERABBIT_FIXES.md
echo "- Fix: <description>" >> CODERABBIT_FIXES.md
```

**5. Re-run wrapper to verify fixes**
```bash
# After applying fixes, verify with another review
wsl bash -c "cd /mnt/e/OneDrive/Documents/kevinalthaus-com-oct && ./scripts/coderabbit-wrapper.sh --type staged"
```

#### Troubleshooting Wrapper Scripts

**Issue: "CodeRabbit CLI not found"**
- Solution: Install CodeRabbit CLI first: `curl -fsSL https://cli.coderabbit.ai/install.sh | sh`
- Verify: `wsl bash -c "which coderabbit"`

**Issue: "Status directory does not exist"**
- Solution: Run the wrapper script at least once to initialize
- Verify: `ls -la .coderabbit-status/`

**Issue: Review hangs or takes too long**
- Solution: Check progress with follow mode: `./scripts/coderabbit-status.sh follow`
- Alternative: Narrow scope with `--type staged` flag

**Issue: Tests fail before review**
- Solution: Wrapper continues to review (tests are non-blocking)
- Check: Review progress log for test output
- Fix tests first if desired: `./scripts/run-tests.sh`

**Issue: JSON parsing errors**
- Solution: Check if jq is installed: `wsl bash -c "which jq"`
- Fallback: Scripts use sed if jq is unavailable
- Verify: Read status.json manually: `cat .coderabbit-status/status.json`
