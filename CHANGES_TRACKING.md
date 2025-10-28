# Changes Tracking Log

This file tracks all changes made to the codebase to identify any circular patterns or recurring issues.

## Change Session: 2025-10-27

### Batch 1: JWT, Timeouts, and Backup Script
1. **docker-compose.yml** (lines 42, 76): Removed mandatory JWT_SECRET expansion
2. **scripts/ensure-jwt-secret.sh**: Created migration script for JWT_SECRET
3. **README.md**: Added JWT_SECRET breaking change documentation
4. **packages/admin/src/lib/api.ts** (line 23): Increased timeout from 10s to 60s
5. **packages/admin/src/lib/api.ts** (line 80): Added 5-minute timeout for uploads
6. **scripts/backup-postgres.sh** (lines 59, 62, 113): Replaced BACKUP_DIR with RESOLVED_BACKUP_DIR
7. **scripts/backup-postgres.sh** (line 113): Added validation before find -delete

### Batch 2: Error Handling, Auth, and Performance (Completed)
8. **docker/postgres/wal-archive.sh** (line 36): Fix chmod error handling - removed `|| true`, added explicit error handling with WARN log
9. **docs/deployment.md** (line 130): Enhanced destructive warning - added bold WARNING label and detailed caution text
10. **packages/main-app/src/auth/index.ts** (lines 621-626): Fixed route comment from `/api/users/me` to `/api/auth/me`
11. **packages/main-app/src/auth/index.ts** (lines 649-658): Added return after 401 response to prevent further execution
12. **packages/main-app/src/auth/index.ts** (lines 599-600): Fixed clearCookie maxAge - created `getCookieClearOptions()` without maxAge
13. **packages/main-app/src/auth/rbac-middleware.ts** (lines 35-57): Added empty capabilities check - fails fast with 500 error
14. **packages/main-app/src/db/migrations.ts** (line 55): Fixed template literal - changed single quotes to backticks
15. **packages/shared/src/database/naming.ts** (lines 28-42): Hash-based fallback prefix - replaced literal 'plugin' with `'p' + hash.substring(0,3)`
16. **packages/shared/src/utils/yaml-parser.ts** (lines 76-90): Cached AJV validator at module load for performance
17. **scripts/setup-cron.sh** (lines 100-102): Refactored to separate script - created `scripts/vacuum-postgres.sh`
18. **scripts/vacuum-postgres.sh**: Created new executable script for VACUUM ANALYZE with proper error handling
19. **scripts/web** (lines 400-449): Improved production error message - detailed detection methods and override steps
20. **scripts/web** (lines 268-279): Fixed health-check counting logic - parse per-container objects atomically

---

## Pattern Analysis
- [ ] Check for repeated issues in the same files
- [ ] Identify systemic problems (e.g., error handling patterns)
- [ ] Note any circular fixes (fixing the same issue twice)

---
