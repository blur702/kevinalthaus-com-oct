# Production Deployment Status

## ✅ Completed Fixes

All production deployment issues have been resolved. The container stack is now ready for deployment.

---

## 🔧 Changes Made

### 1. Fixed main-app Docker Build (docker/main-app/Dockerfile)

**Problem**: Plugins were being built before @monorepo/shared, but they depend on it.

**Solution**: Reordered build steps to:
1. Build @monorepo/shared first
2. Then build plugins (page-builder, file-manager, content-manager, taxonomy, user-manager)
3. Finally build @monorepo/main-app

**File**: `docker/main-app/Dockerfile` (lines 27-38)

### 2. Added Redis Service (docker-compose.prod.yml)

**Added**:
- Redis 7 Alpine container with password authentication
- Persistent volume for Redis data
- Health checks and resource limits
- Proper network configuration

**Configuration**:
- Port: 6379 (internal only)
- Password required via `REDIS_PASSWORD` environment variable
- Append-only file persistence enabled

**File**: `docker-compose.prod.yml` (lines 53-78)

### 3. Added Python Service (docker-compose.prod.yml)

**Added**:
- Python FastAPI service container
- PostgreSQL and SSL/TLS configuration
- Health checks at `/health` endpoint
- Proper resource limits (1 CPU, 512MB RAM)

**Configuration**:
- Port: 8000 (internal only)
- Connects to PostgreSQL with SSL verification
- Uses Docker secrets for credentials

**File**: `docker-compose.prod.yml` (lines 80-119)

### 4. Wired Redis to main-app and api-gateway

**Added environment variables**:
- `REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379`
- Dependencies on redis service with health checks

**Files**:
- `docker-compose.prod.yml` (line 140 for api-gateway)
- `docker-compose.prod.yml` (line 199 for main-app)

### 5. Added Python Service URL to main-app

**Added**:
- `PYTHON_SERVICE_URL=http://python-service:8000`
- Dependency on python-service with health check

**File**: `docker-compose.prod.yml` (line 200)

### 6. Updated Environment Configuration

**Updated `.env.production`**:
- Added `CSRF_SECRET`
- Added `FINGERPRINT_SECRET`
- Added `INTERNAL_GATEWAY_TOKEN`
- Uncommented and configured Redis settings:
  - `REDIS_HOST=redis`
  - `REDIS_PORT=6379`
  - `REDIS_PASSWORD` (must be generated)
  - `REDIS_URL` (constructed from above)

**Updated `.env.example`**:
- Added `POSTGRES_USER` and `POSTGRES_DB`
- Added `REDIS_PASSWORD` section

**Files**: `.env.production`, `.env.example`

### 7. Fixed Admin Dockerfile for Service Worker

**Problem**: Admin uses root `public/` directory (via vite.config.ts) but Dockerfile didn't copy it.

**Solution**: Added `COPY public ./public` to ensure sw.js and theme CSS files are available during build.

**File**: `docker/admin/Dockerfile` (lines 23-24)

### 8. Updated Deployment Script

**Improvements**:
1. Added ca.crt generation in `generate_secrets()` function
   - Copies server.crt to ca.crt for PostgreSQL SSL verification

2. Fixed Docker Compose commands:
   - Changed from `docker-compose` to `docker compose` (V2 syntax)
   - Removed redundant `-f $COMPOSE_FILE` (now only uses prod file)
   - Uses only `docker-compose.prod.yml` for production

**File**: `scripts/deploy-to-prod.sh`

### 9. Added REDIS_PASSWORD to Local Environment

**Added**: Generated Redis password to local `.env` file for testing.

**File**: `.env` (last line)

---

## 📋 Pre-Deployment Checklist

Before deploying to production, ensure you complete these steps:

### 1. Generate Production Secrets

Edit `.env.production` and replace all placeholder values:

```bash
# Generate all secrets at once
openssl rand -hex 32  # JWT_SECRET
openssl rand -hex 32  # SESSION_SECRET
openssl rand -hex 32  # CSRF_SECRET
openssl rand -hex 32  # FINGERPRINT_SECRET
openssl rand -hex 32  # ENCRYPTION_KEY
openssl rand -hex 32  # PLUGIN_SIGNATURE_SECRET
openssl rand -hex 32  # INTERNAL_GATEWAY_TOKEN
openssl rand -hex 32  # REDIS_PASSWORD
```

### 2. Update .env.production with Your Domain

```bash
# Application URLs (replace with your actual domain)
API_URL=https://kevinalthaus.com
FRONTEND_URL=https://kevinalthaus.com
ADMIN_URL=https://kevinalthaus.com/admin

# CORS Configuration
CORS_ORIGIN=https://kevinalthaus.com,https://kevinalthaus.com/admin
```

### 3. Set Deployment Password

The deployment script needs your production server sudo password:

```bash
# In .env.local (NOT committed to git)
PROD_SUDO_PASSWORD=your_production_sudo_password
```

Or export it before running the script:

```bash
export PROD_SUDO_PASSWORD='your_production_sudo_password'
```

### 4. Verify SSH Access

Test SSH connection to production server:

```bash
./scripts/test-ssh-connection.sh
```

If this fails, set up SSH keys:

```bash
./scripts/setup-ssh-keys.sh
```

---

## 🚀 Deployment Steps

### Option 1: Full Deployment (Recommended)

Run the complete deployment script:

```bash
./scripts/deploy-to-prod.sh
```

This will:
1. Verify SSH connection
2. Install prerequisites (Git, Docker, Docker Compose)
3. Clone/update repository
4. Copy `.env.production` to server as `.env`
5. Generate secrets (if they don't exist)
6. Build and start all Docker containers
7. Verify deployment health

### Option 2: Force Rebuild

If you want to force rebuild all containers:

```bash
./scripts/deploy-to-prod.sh --force-rebuild
```

### Option 3: Non-Interactive (for CI/CD)

Skip all confirmation prompts:

```bash
./scripts/deploy-to-prod.sh --non-interactive
```

---

## 🧪 Local Testing

Test the complete stack locally before deploying:

### 1. Ensure All Secrets Are Set

```bash
# Check that .env has all required values
grep -E "^(JWT_SECRET|FINGERPRINT_SECRET|CSRF_SECRET|SESSION_SECRET|ENCRYPTION_KEY|PLUGIN_SIGNATURE_SECRET|INTERNAL_GATEWAY_TOKEN|REDIS_PASSWORD)=" .env
```

### 2. Verify Secrets Directory

```bash
# Ensure all TLS files exist
ls -la secrets/
# Should show: ca.crt, postgres_password.txt, server.crt, server.key
```

### 3. Build and Start Stack

```bash
# Clean any existing containers
docker compose -f docker-compose.prod.yml down -v

# Build all images
docker compose -f docker-compose.prod.yml build

# Start the stack
docker compose -f docker-compose.prod.yml up -d

# Watch logs
docker compose -f docker-compose.prod.yml logs -f
```

### 4. Verify Services

```bash
# Check container status
docker compose -f docker-compose.prod.yml ps

# Test health endpoints
curl http://localhost:4000/health          # API Gateway
curl http://localhost:3002/                # Frontend
curl http://localhost:3003/                # Admin
```

### 5. Stop and Clean Up

```bash
docker compose -f docker-compose.prod.yml down
```

---

## 🏥 Service Health Endpoints

After deployment, verify all services are healthy:

### Internal Services (accessible from server)

```bash
# On production server
curl http://localhost:4000/health          # API Gateway
curl http://postgres:5432                  # PostgreSQL (via docker network)
curl http://redis:6379                     # Redis (via docker network)
curl http://python-service:8000/health     # Python Service
curl http://main-app:3001/health           # Main App
```

### Public Services (accessible via Nginx)

```bash
# From anywhere
curl https://kevinalthaus.com/             # Frontend
curl https://kevinalthaus.com/admin/       # Admin
curl https://kevinalthaus.com/api/health   # API via Gateway
```

---

## 🔍 Troubleshooting

### Container Won't Start

```bash
# Check logs for specific service
docker compose -f docker-compose.prod.yml logs main-app
docker compose -f docker-compose.prod.yml logs python-service
docker compose -f docker-compose.prod.yml logs redis
```

### Missing Environment Variables

```bash
# Verify .env file on server
ssh kevin-prod "cat /opt/kevinalthaus/.env | grep -E '^(JWT_SECRET|REDIS_PASSWORD)='"
```

### PostgreSQL SSL Issues

```bash
# Verify ca.crt exists
ssh kevin-prod "ls -la /opt/kevinalthaus/secrets/ca.crt"

# Check PostgreSQL logs
docker compose -f docker-compose.prod.yml logs postgres
```

### Python Service Crashes

```bash
# Check if python directory exists in repo
ssh kevin-prod "ls -la /opt/kevinalthaus/python/"

# Check requirements.txt
ssh kevin-prod "cat /opt/kevinalthaus/python/requirements.txt"

# View python-service logs
docker compose -f docker-compose.prod.yml logs python-service
```

### Redis Connection Issues

```bash
# Test Redis connection
docker compose -f docker-compose.prod.yml exec redis redis-cli ping

# Check Redis password
echo $REDIS_PASSWORD
```

---

## 📊 Service Ports

### Internal Network (Docker)

| Service         | Port | Access                          |
|----------------|------|---------------------------------|
| PostgreSQL     | 5432 | Internal only                   |
| Redis          | 6379 | Internal only                   |
| API Gateway    | 3000 | Exposed as 4000 on host        |
| Main App       | 3001 | Internal only (via gateway)    |
| Frontend       | 3000 | Exposed as 3002 on host        |
| Admin          | 3000 | Exposed as 3003 on host        |
| Python Service | 8000 | Internal only                   |

### Host Ports (Accessible from Nginx)

| Port | Service         | Public URL                               |
|------|----------------|------------------------------------------|
| 4000 | API Gateway    | https://kevinalthaus.com/api (via Nginx) |
| 3002 | Frontend       | https://kevinalthaus.com (via Nginx)     |
| 3003 | Admin          | https://kevinalthaus.com/admin (Nginx)   |

---

## 🔐 Security Notes

1. **Never commit secrets**: `.env` and `.env.production` are in `.gitignore`
2. **Rotate secrets regularly**: Generate new secrets every 90 days
3. **Use strong passwords**: Minimum 32 characters for all secrets
4. **Restrict file permissions**: `chmod 600 .env.production` and all secret files
5. **Enable firewall**: Only ports 22, 80, 443 should be open on production
6. **SSL/TLS**: All services use encrypted connections (PostgreSQL, Redis via password)
7. **No root**: All containers run as non-root users (appuser)

---

## 📝 Next Steps

After successful deployment:

1. **Remove Nginx alias hack** (serving sw.js from repo root)
   - Verify sw.js is served from frontend/admin dist
   - Remove `/sw.js` location block from Nginx config

2. **Setup certbot auto-renewal**:
   ```bash
   ssh kevin-prod "sudo systemctl enable certbot.timer"
   ssh kevin-prod "sudo certbot renew --dry-run"
   ```

3. **Take production screenshots**:
   ```bash
   # Frontend
   curl https://kevinalthaus.com > /tmp/frontend-test.html

   # Admin
   curl https://kevinalthaus.com/admin > /tmp/admin-test.html
   ```

4. **Monitor logs**:
   ```bash
   ssh kevin-prod "cd /opt/kevinalthaus && docker compose -f docker-compose.prod.yml logs -f"
   ```

5. **Setup monitoring/alerts** for service health

---

## ✅ Deployment Verification Checklist

After running `./scripts/deploy-to-prod.sh`, verify:

- [ ] All containers are running: `docker compose ps`
- [ ] PostgreSQL is healthy: `docker compose exec postgres pg_isready`
- [ ] Redis is healthy: `docker compose exec redis redis-cli ping`
- [ ] API Gateway responds: `curl http://localhost:4000/health`
- [ ] Python Service responds: Health check in logs
- [ ] Main App responds: Health check via Gateway
- [ ] Frontend loads: `curl https://kevinalthaus.com`
- [ ] Admin loads: `curl https://kevinalthaus.com/admin`
- [ ] No errors in logs: `docker compose logs --tail=50`

---

## 📚 Related Documentation

- `.claude/CLAUDE.md` - Port management and development workflow
- `SSH-SETUP-INSTRUCTIONS.md` - SSH key setup guide
- `DEPLOYMENT-READY-CHECKLIST.md` - Complete deployment checklist
- `docs/deployment.md` - Full deployment documentation
- `docker-compose.prod.yml` - Production Docker configuration
- `.env.production` - Production environment template

---

Generated: 2025-11-17
Last Updated: 2025-11-17
