# Page Builder Deployment Guide

This document provides deployment procedures, migration safety guidelines, and production best practices for the Page Builder plugin.

## Table of Contents

- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Building for Production](#building-for-production)
- [Database Migration Safety](#database-migration-safety)
- [Deployment Steps](#deployment-steps)
- [Rollback Procedures](#rollback-procedures)
- [Monitoring & Observability](#monitoring--observability)
- [Performance Tuning](#performance-tuning)

## Pre-Deployment Checklist

### Code Quality

- [ ] All tests passing (`npm test`)
- [ ] Code coverage meets thresholds (80%+ line coverage)
- [ ] Linting passes with no errors (`npm run lint`)
- [ ] TypeScript compilation succeeds (`npm run build`)
- [ ] No security vulnerabilities (`npm audit`)
- [ ] Dependency versions are stable (no pre-release versions)

### Database

- [ ] Migrations tested in staging environment
- [ ] Backup created before migration
- [ ] Rollback script prepared
- [ ] Migration idempotency verified (can run multiple times safely)
- [ ] Database connection pool configured
- [ ] Indexes exist for performance-critical queries

### Security

- [ ] All inputs sanitized (HTML, URLs, JSON)
- [ ] CSRF protection enabled
- [ ] Rate limiting configured
- [ ] CSP headers set correctly
- [ ] Authentication/authorization tested
- [ ] Security audit log enabled
- [ ] No secrets in environment variables

### Performance

- [ ] JSONB indexes created (GIN indexes)
- [ ] Partial indexes for soft deletes
- [ ] Query execution plans reviewed
- [ ] Frontend bundle size optimized
- [ ] Image assets optimized
- [ ] Lazy loading implemented

### Documentation

- [ ] README updated with latest features
- [ ] API documentation current
- [ ] Migration notes documented
- [ ] Breaking changes listed
- [ ] Deployment notes prepared

## Building for Production

### Build Process

```bash
# Clean previous builds
npm run clean

# Install production dependencies only
npm ci --production=false

# Build TypeScript
npm run build

# Run production build validation
npm run build:validate
```

### Build Output Verification

```bash
# Verify dist directory structure
ls -la dist/

# Expected output:
# dist/
#   index.js
#   index.d.ts
#   index.js.map
#   types/
#     index.js
#     index.d.ts
#     index.js.map
```

### Lerna Publishing

For monorepo deployment:

```bash
# Bump version
lerna version patch --no-push

# Build all packages
lerna run build

# Publish to npm (if applicable)
lerna publish from-package

# Or deploy to internal registry
lerna publish from-package --registry=https://internal-registry.example.com
```

## Database Migration Safety

### Pre-Migration Backup

**Critical**: Always backup before migrations!

```bash
# Backup entire database
pg_dump -h localhost -U postgres -d production_db -F c -f backup_$(date +%Y%m%d_%H%M%S).dump

# Backup specific schema only
pg_dump -h localhost -U postgres -d production_db -n plugin_page_builder -F c -f page_builder_backup_$(date +%Y%m%d_%H%M%S).dump
```

### Migration Testing

Test migrations in staging first:

```bash
# 1. Restore production snapshot to staging
pg_restore -h staging-db -U postgres -d staging_db backup.dump

# 2. Run migrations
npm run migrate:staging

# 3. Verify data integrity
npm run verify:migration

# 4. Test rollback
npm run migrate:rollback
npm run migrate:staging
```

### Migration Execution

```sql
-- Check current state
SELECT * FROM plugin_page_builder.plugin_migrations ORDER BY executed_at DESC;

-- Execute pending migrations (handled by plugin onInstall/onUpdate)
-- Migrations run automatically when plugin is installed/updated

-- Verify success
SELECT migration_name, executed_at
FROM plugin_page_builder.plugin_migrations
ORDER BY executed_at DESC
LIMIT 5;
```

### Migration Safety Patterns

#### Backward Compatible Migrations

Add new columns as nullable:

```sql
-- ✅ SAFE: Nullable new column
ALTER TABLE plugin_page_builder.pages
ADD COLUMN new_field TEXT;

-- ❌ RISKY: Required column without default
ALTER TABLE plugin_page_builder.pages
ADD COLUMN required_field TEXT NOT NULL;

-- ✅ BETTER: Required with default
ALTER TABLE plugin_page_builder.pages
ADD COLUMN required_field TEXT NOT NULL DEFAULT 'default_value';
```

#### Indexes Without Locking

Create indexes concurrently:

```sql
-- ✅ SAFE: No table lock
CREATE INDEX CONCURRENTLY idx_pages_new_field
  ON plugin_page_builder.pages (new_field);

-- ❌ RISKY: Locks table during creation
CREATE INDEX idx_pages_new_field
  ON plugin_page_builder.pages (new_field);
```

#### Data Migrations

Split data migrations into separate steps:

```sql
-- Step 1: Add nullable column
ALTER TABLE plugin_page_builder.pages ADD COLUMN status_v2 VARCHAR(50);

-- Step 2: Backfill in batches (via application code)
-- UPDATE plugin_page_builder.pages
-- SET status_v2 = status::VARCHAR
-- WHERE status_v2 IS NULL
-- LIMIT 1000;

-- Step 3: Add NOT NULL constraint (after backfill complete)
-- ALTER TABLE plugin_page_builder.pages
-- ALTER COLUMN status_v2 SET NOT NULL;

-- Step 4: Drop old column
-- ALTER TABLE plugin_page_builder.pages DROP COLUMN status;

-- Step 5: Rename new column
-- ALTER TABLE plugin_page_builder.pages RENAME COLUMN status_v2 TO status;
```

## Deployment Steps

### 1. Pre-Deployment

```bash
# Tag release
git tag v1.0.0
git push origin v1.0.0

# Build production artifacts
npm run build

# Run final tests
npm test

# Create database backup
./scripts/backup-database.sh
```

### 2. Deploy Application

#### Option A: Docker Deployment

```bash
# Build Docker image
docker build -t page-builder-plugin:1.0.0 .

# Push to registry
docker push registry.example.com/page-builder-plugin:1.0.0

# Deploy to production
kubectl set image deployment/page-builder \
  page-builder=registry.example.com/page-builder-plugin:1.0.0

# Verify deployment
kubectl rollout status deployment/page-builder
```

#### Option B: Direct Deployment

```bash
# SSH to production server
ssh production-server

# Pull latest code
cd /var/www/page-builder-plugin
git fetch origin
git checkout v1.0.0

# Install dependencies
npm ci --production

# Build
npm run build

# Restart application
pm2 restart page-builder-plugin
```

### 3. Run Migrations

Migrations run automatically during plugin activation, but verify:

```bash
# Check migration status via API
curl -X GET https://api.example.com/admin/plugins/page-builder/migrations

# Or query database directly
psql -h production-db -U postgres -d production_db -c \
  "SELECT * FROM plugin_page_builder.plugin_migrations ORDER BY executed_at DESC;"
```

### 4. Smoke Tests

```bash
# Health check
curl https://api.example.com/api/page-builder/health

# Create test page
curl -X POST https://api.example.com/api/page-builder/pages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Deployment Test",
    "slug": "deployment-test-'$(date +%s)'",
    "layout_json": {...}
  }'

# Retrieve page
curl https://api.example.com/pages/deployment-test-...

# Delete test page
curl -X DELETE https://api.example.com/api/page-builder/pages/$PAGE_ID
```

### 5. Monitoring

Enable monitoring immediately after deployment:

```bash
# Check application logs
tail -f /var/log/page-builder/app.log

# Check error rates
curl https://monitoring.example.com/api/metrics/errors?service=page-builder

# Check database performance
psql -h production-db -U postgres -d production_db -c \
  "SELECT * FROM pg_stat_statements WHERE query LIKE '%plugin_page_builder%' ORDER BY total_time DESC LIMIT 10;"
```

## Rollback Procedures

### Application Rollback

#### Docker

```bash
# Rollback to previous version
kubectl rollout undo deployment/page-builder

# Or specific revision
kubectl rollout undo deployment/page-builder --to-revision=2
```

#### Direct Deployment

```bash
# Revert to previous Git tag
git checkout v0.9.0

# Rebuild
npm ci --production
npm run build

# Restart
pm2 restart page-builder-plugin
```

### Database Rollback

#### Migration Rollback

If migrations support rollback (down migrations):

```sql
-- Rollback specific migration
DELETE FROM plugin_page_builder.plugin_migrations
WHERE migration_name = '04-create-reusable-blocks-table';

-- Then manually revert changes
DROP TABLE IF EXISTS plugin_page_builder.reusable_blocks;
```

#### Full Database Restore

**Use as last resort** - results in data loss:

```bash
# Stop application
pm2 stop page-builder-plugin

# Drop schema
psql -h production-db -U postgres -d production_db -c \
  "DROP SCHEMA IF EXISTS plugin_page_builder CASCADE;"

# Restore from backup
pg_restore -h production-db -U postgres -d production_db backup.dump

# Restart application
pm2 start page-builder-plugin
```

## Monitoring & Observability

### Key Metrics

Monitor these metrics post-deployment:

- **Error Rate**: < 1% of requests
- **Response Time**: p95 < 500ms for API calls
- **Database Query Time**: p95 < 100ms
- **CPU Usage**: < 70% average
- **Memory Usage**: < 80% of available
- **Database Connections**: < 80% of pool size

### Logging

Ensure structured logging is configured:

```typescript
// Example log format
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "service": "page-builder",
  "message": "Page created",
  "userId": "uuid",
  "pageId": "uuid",
  "duration": 45
}
```

### Alerts

Configure alerts for:

- Error rate exceeds 5% for 5 minutes
- Response time p95 > 1 second for 10 minutes
- Database connection pool exhausted
- Failed migration execution
- Security audit log shows suspicious activity

### Dashboards

Create dashboards for:

- Request volume and latency
- Error rates by endpoint
- Database query performance
- Widget usage statistics
- Template creation trends

## Performance Tuning

### Database Optimization

```sql
-- Analyze table statistics
ANALYZE plugin_page_builder.pages;
ANALYZE plugin_page_builder.templates;

-- Vacuum to reclaim space
VACUUM ANALYZE plugin_page_builder.pages;

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'plugin_page_builder'
ORDER BY idx_scan ASC;

-- Check slow queries
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE query LIKE '%plugin_page_builder%'
ORDER BY mean_time DESC
LIMIT 20;
```

### Connection Pool Tuning

```typescript
// Adjust pool size based on load
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum connections
  min: 5,  // Minimum idle connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  statement_timeout: 10000 // 10 second query timeout
});
```

### Caching Strategy

Implement caching for read-heavy operations:

```typescript
import NodeCache from 'node-cache';

const pageCache = new NodeCache({
  stdTTL: 300, // 5 minutes
  checkperiod: 60
});

export async function getCachedPage(pageId: string): Promise<Page> {
  const cached = pageCache.get<Page>(pageId);
  if (cached) return cached;

  const page = await fetchPageFromDb(pageId);
  pageCache.set(pageId, page);
  return page;
}
```

## Post-Deployment

### Verification Checklist

- [ ] All smoke tests passed
- [ ] Error rates normal (< 1%)
- [ ] Response times acceptable (p95 < 500ms)
- [ ] Database queries optimized (p95 < 100ms)
- [ ] No critical alerts triggered
- [ ] User-facing features working correctly
- [ ] Security scans show no new vulnerabilities

### Documentation Updates

- [ ] Update changelog with deployment notes
- [ ] Document any configuration changes
- [ ] Update runbook with lessons learned
- [ ] Notify team of deployment completion

## References

- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Blue-Green Deployments](https://martinfowler.com/bliki/BlueGreenDeployment.html)
- [Database Migration Best Practices](https://www.postgresql.org/docs/current/sql-altertable.html)
- [Kubernetes Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
