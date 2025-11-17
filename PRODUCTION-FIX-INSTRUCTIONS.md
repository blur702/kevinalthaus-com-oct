# Production Server Fix Instructions

**Issue:** Login fails with 502 Bad Gateway error
**Root Cause:** Backend services (main-app, api-gateway, postgres) are not running
**Status:** Only frontend (port 3002) and admin (port 3003) containers are running

---

## Quick Fix (Recommended)

SSH into the production server and start all services using the production compose file:

```bash
# 1. Connect to server
ssh kevin@65.181.112.77
# Use SSH key authentication (no password needed)

# 2. Navigate to application directory
cd /opt/kevinalthaus

# 3. Check current status
docker compose ps

# 4. Start all services from production compose file
docker compose -f docker-compose.prod.yml up -d

# 5. Verify all containers are running
docker compose -f docker-compose.prod.yml ps

# 6. Check logs for any errors
docker compose -f docker-compose.prod.yml logs --tail=50

# 7. Wait for services to become healthy (30-60 seconds)
watch -n 2 'docker compose ps'
```

---

## Expected Services After Fix

Once fixed, you should see these containers running:

1. **postgres** - Database server (internal port 5432)
2. **main-app** - Backend API server (internal port 3003)
3. **api-gateway** - API Gateway (port 4000 or as configured)
4. **plugin-engine** - Plugin system (port 3004)
5. **frontend** - Public website (port 3002) ✅ Already running
6. **admin** - Admin dashboard (port 3003) ✅ Already running

---

## Verification Steps

After starting services, verify they're working:

### 1. Check Container Health
```bash
docker compose -f docker-compose.prod.yml ps
```
All containers should show status "Up" and "(healthy)"

### 2. Test Health Endpoints
```bash
# From production server
curl http://localhost:4000/health  # API Gateway
curl http://localhost:3003/health  # Main App

# From your local machine
curl http://65.181.112.77/health
```

### 3. Test Database Connection
```bash
docker compose -f docker-compose.prod.yml exec postgres pg_isready
docker compose -f docker-compose.prod.yml exec main-app env | grep DB_
```

### 4. Check Service Logs
```bash
# Check for errors in each service
docker compose -f docker-compose.prod.yml logs main-app --tail=50
docker compose -f docker-compose.prod.yml logs api-gateway --tail=50
docker compose -f docker-compose.prod.yml logs postgres --tail=50
```

### 5. Re-run Playwright Test
```bash
# From your development machine
npx playwright test --config=playwright.config.prod.ts --grep "discover"
```

The login test should now pass successfully.

---

## Troubleshooting

### If services fail to start:

**Check for missing environment variables:**
```bash
cd /opt/kevinalthaus
cat .env
# Verify all required secrets exist
```

**Check for missing secret files:**
```bash
ls -la secrets/
# Should contain:
# - postgres_password.txt
# - server.crt
# - server.key
```

**Check Docker logs for specific errors:**
```bash
docker compose -f docker-compose.prod.yml logs main-app
docker compose -f docker-compose.prod.yml logs postgres
```

### If PostgreSQL won't start:

```bash
# Check if data directory has correct permissions
docker compose -f docker-compose.prod.yml exec postgres ls -la /var/lib/postgresql/data

# Try restarting just PostgreSQL
docker compose -f docker-compose.prod.yml restart postgres
```

### If services are unhealthy:

```bash
# Check healthcheck logs
docker inspect kevinalthaus-main-app-1 | grep -A 10 Health

# Restart unhealthy services
docker compose -f docker-compose.prod.yml restart main-app
```

### Port Conflicts:

```bash
# Check what's using the ports
sudo netstat -tulpn | grep -E ':(3000|3003|4000|5432)'

# If conflicts exist, stop conflicting services
sudo systemctl stop <conflicting-service>
```

---

## Alternative: Full Redeployment

If the above doesn't work, perform a full redeployment:

```bash
# From your development machine
./scripts/deploy-to-prod.sh
```

This will:
1. Connect to production server via SSH
2. Pull latest code from Git
3. Build Docker images
4. Start all services
5. Verify deployment

---

## Post-Fix Validation Checklist

After fixing, verify:

- [ ] All Docker containers running and healthy
- [ ] Health endpoint returns 200: `curl http://65.181.112.77/health`
- [ ] Database is accessible: `docker compose exec postgres pg_isready`
- [ ] No errors in service logs: `docker compose logs --tail=50`
- [ ] Login test passes: `npx playwright test --config=playwright.config.prod.ts`
- [ ] Can login via browser: `http://65.181.112.77/login`
- [ ] Session persists after login
- [ ] Dashboard loads after successful login

---

## Monitoring Recommendations

To prevent this issue in the future:

1. **Setup healthcheck monitoring**
   - Configure uptime monitoring (e.g., UptimeRobot, Pingdom)
   - Alert on 502 errors or service downtime

2. **Auto-restart policy**
   ```yaml
   # In docker-compose.prod.yml
   restart: unless-stopped
   ```

3. **Log aggregation**
   - Send Docker logs to centralized logging (e.g., CloudWatch, Datadog)
   - Alert on critical errors

4. **Resource monitoring**
   ```bash
   # Check container resource usage
   docker stats
   ```

5. **Automated health checks**
   ```bash
   # Add to crontab
   */5 * * * * /opt/kevinalthaus/scripts/health-check.sh
   ```

---

## Contact Info

If issues persist after following these steps:

1. Check logs: `docker compose -f docker-compose.prod.yml logs --tail=100`
2. Review the detailed report: `PRODUCTION-LOGIN-TEST-REPORT.md`
3. Check Docker status: `docker ps -a`
4. Verify disk space: `df -h`
5. Check memory: `free -m`

---

## Summary

**Problem:** Backend services not running
**Solution:** Start services with `docker compose -f docker-compose.prod.yml up -d`
**Verification:** Re-run Playwright test to confirm login works
**Time to Fix:** 5-10 minutes

The frontend is working perfectly - we just need to start the backend services!
