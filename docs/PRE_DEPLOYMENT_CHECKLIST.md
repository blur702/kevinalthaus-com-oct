# Pre-Deployment Security Checklist

This checklist must be completed before deploying to production.

## 🔐 Security Secrets

- [ ] Run `./scripts/validate-secrets.sh` and ensure all checks pass
- [ ] Verify all 7 required secrets are set in `.env`:
  - [ ] `JWT_SECRET` (32+ characters)
  - [ ] `SESSION_SECRET` (32+ characters)
  - [ ] `CSRF_SECRET` (32+ characters)
  - [ ] `INTERNAL_GATEWAY_TOKEN` (32+ characters)
  - [ ] `ENCRYPTION_KEY` (32+ characters)
  - [ ] `PLUGIN_SIGNATURE_SECRET` (32+ characters)
  - [ ] `FINGERPRINT_SECRET` (32+ characters)
- [ ] Confirm no secrets contain "REPLACE_WITH", "YOUR_*_HERE", or other placeholders
- [ ] Verify `.env` file has restricted permissions (`chmod 600 .env`)
- [ ] Ensure `.env` is in `.gitignore` and NOT committed to version control

## 🗄️ Database

- [ ] Database migrations completed successfully
- [ ] Database backup strategy in place
- [ ] Database connection pooling configured appropriately
- [ ] Database credentials secured (not using default passwords)

- [ ] Test email configuration working (run test endpoint)
- [ ] SMTP credentials secured
- [ ] Email rate limiting configured

## 🌐 Network & Infrastructure

- [ ] SSL/TLS certificates valid and properly configured
- [ ] CORS origins configured for production domains only
- [ ] Rate limiting enabled and tested
- [ ] Firewall rules configured
- [ ] Load balancer health checks configured (if applicable)

## 📦 Application Build

- [ ] Run `npm run build` successfully for all packages
- [ ] TypeScript compilation passes with no errors (`npx tsc --noEmit`)
- [ ] No console.log statements in production code
- [ ] No commented-out code blocks
- [ ] Dependencies audited (`npm audit`) and critical vulnerabilities resolved

## 🧪 Testing

- [ ] All unit tests passing (`npm test`)
- [ ] Critical E2E tests passing
- [ ] Manual QA completed for core features:
  - [ ] User authentication (login/logout)
  - [ ] Blog post creation and editing
  - [ ] File uploads
  - [ ] Plugin activation/deactivation
  - [ ] Admin dashboard access

## 🔒 Security Hardening

- [ ] XSS protection enabled (DOMPurify integrated)
- [ ] CSRF protection enabled and tested
- [ ] Helmet.js security headers configured
- [ ] File upload validation working (file type, size limits)
- [ ] SQL injection protection (using parameterized queries)
- [ ] Authentication rate limiting enabled
- [ ] Session security configured (secure cookies, httpOnly, sameSite)

## 📊 Monitoring & Logging

- [ ] Sentry configured for error tracking (or SENTRY_DSN removed if not using)
- [ ] Application logging configured appropriately
- [ ] Log rotation configured
- [ ] Monitoring alerts configured (uptime, errors, performance)

## 🚀 Deployment Configuration

- [ ] `NODE_ENV` set to `production`
- [ ] Port configuration correct for production environment
- [ ] Static file serving configured
- [ ] Proxy configuration (if using reverse proxy like Nginx)
- [ ] Process manager configured (PM2, systemd, Docker, etc.)
- [ ] Auto-restart on failure configured

## 📋 Plugin System

- [ ] All required plugins installed and activated
- [ ] Plugin database migrations completed
- [ ] Plugin configurations validated
- [ ] Disabled/test plugins removed from production

## 🔄 Backup & Recovery

- [ ] Database backup schedule configured
- [ ] File upload backups configured
- [ ] Disaster recovery plan documented
- [ ] Rollback procedure tested

## 📝 Documentation

- [ ] Production deployment guide updated
- [ ] API documentation current
- [ ] Environment variables documented
- [ ] Troubleshooting guide available

## ✅ Final Checks

- [ ] Run startup validation: application starts without errors
- [ ] Verify no placeholder secrets trigger validation errors
- [ ] Check all critical endpoints return expected responses
- [ ] Verify admin dashboard accessible
- [ ] Test user registration and login flows
- [ ] Confirm email notifications working

## 🚨 Post-Deployment

- [ ] Monitor error logs for first 24 hours
- [ ] Verify application performance metrics
- [ ] Check database connection pool usage
- [ ] Monitor memory and CPU usage
- [ ] Verify backup jobs running successfully
- [ ] Test critical user flows in production

---

## Automated Validation

Run these commands before deployment:

```bash
# Validate all secrets
./scripts/validate-secrets.sh

# Check TypeScript compilation
npx tsc --noEmit

# Run tests
npm test

# Audit dependencies
npm audit

# Build for production
npm run build
```

## Emergency Contacts

- Development Team Lead: [Contact Info]
- DevOps/Infrastructure: [Contact Info]
- Database Administrator: [Contact Info]

## Rollback Plan

If deployment fails:

1. Revert to previous version using your deployment system
2. Restore database from last backup if migrations were applied
3. Clear application cache
4. Restart services
5. Verify rollback successful
6. Document failure reason for post-mortem

---

**Date Prepared:** [Date]  
**Prepared By:** [Name]  
**Reviewed By:** [Name]  
**Approved By:** [Name]
