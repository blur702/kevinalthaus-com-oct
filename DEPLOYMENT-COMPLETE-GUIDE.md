# 🚀 Complete Deployment Guide - All Methods

## Current Status

**Backend Services**: Down (waiting for deployment)
- API Gateway: 502 (needs SESSION_SECRET/CSRF_SECRET fix)
- Main-App: 502 (needs SSL certificate path fix)

**Frontend Services**: ✅ Working
- Frontend: https://kevinalthaus.com (200 OK)
- Admin: https://kevinalthaus.com/admin (200 OK)

**All fixes are committed and ready**: Just pull latest code and restart containers!

---

## 🎯 Choose Your Deployment Method

### Method 1: One-Line Script (Easiest) ⭐ RECOMMENDED

**When**: You have console/SSH access to the server

```bash
cd /opt/kevinalthaus && ./DEPLOY-NOW.sh
```

That's it! The script handles everything automatically.

---

### Method 2: Manual Commands

**When**: You prefer step-by-step control

```bash
cd /opt/kevinalthaus
git pull origin main
docker compose -f docker-compose.prod.yml up -d --force-recreate api-gateway main-app
sleep 15
docker compose -f docker-compose.prod.yml ps
curl https://kevinalthaus.com/api/health
```

---

### Method 3: HTTP Webhook Trigger

**When**: You want to deploy remotely without SSH

**First-time setup** (requires SSH once):
```bash
# On server
cd /opt/kevinalthaus
export DEPLOY_WEBHOOK_SECRET=$(openssl rand -hex 32)
echo "DEPLOY_WEBHOOK_SECRET=$DEPLOY_WEBHOOK_SECRET" >> .env.local
node deploy-webhook.js &
```

**Trigger deployment** (from anywhere):
```bash
TOKEN="your-secret-token"
curl -X POST http://kevinalthaus.com:3333/deploy \
  -H "Authorization: Bearer $TOKEN"
```

See `WEBHOOK-DEPLOYMENT.md` for full setup including systemd service.

---

### Method 4: GitHub Actions Workflow

**When**: You want automated deployment from GitHub

**Setup**:
1. Authenticate GitHub CLI:
   ```bash
   gh auth login
   ```

2. Add SSH key to GitHub Secrets:
   ```bash
   gh secret set PROD_SSH_KEY < ~/.ssh/id_kevin_prod
   ```

3. Trigger deployment:
   ```bash
   gh workflow run deploy-production.yml
   ```

   Or via GitHub UI:
   - Go to: https://github.com/blur702/kevinalthaus-com-oct/actions
   - Select "Deploy to Production"
   - Click "Run workflow"
   - Type "deploy" to confirm
   - Click "Run workflow"

---

## 📊 What Each Method Does

All methods perform the same actions:

1. **Pull latest code** from GitHub main branch
2. **Restart containers**: `docker compose up -d --force-recreate api-gateway main-app`
3. **Wait for startup** (10-15 seconds)
4. **Verify status** and return results

The only difference is **how you trigger it**:
- **Script/Manual**: Directly on server
- **Webhook**: Via HTTP POST from anywhere
- **GitHub Actions**: Via GitHub's runners

---

## ✅ Verification Steps

After deployment completes:

### 1. Check Container Status
```bash
docker compose -f docker-compose.prod.yml ps
```

Expected: All services showing "Up" and "healthy"

### 2. Test Health Endpoints
```bash
# API Gateway
curl https://kevinalthaus.com/api/health
# Expected: {"status":"ok"} or similar

# Frontend
curl -I https://kevinalthaus.com
# Expected: HTTP/1.1 200 OK

# Admin
curl -I https://kevinalthaus.com/admin
# Expected: HTTP/1.1 200 OK
```

### 3. Check Logs
```bash
# API Gateway logs
docker compose -f docker-compose.prod.yml logs api-gateway --tail=50

# Main-App logs
docker compose -f docker-compose.prod.yml logs main-app --tail=50

# All recent logs
docker compose -f docker-compose.prod.yml logs --tail=20
```

### 4. Test Application
- Visit https://kevinalthaus.com
- Visit https://kevinalthaus.com/admin
- Test login functionality
- Verify API calls work

---

## 🔧 Troubleshooting

### Containers Still Failing?

**Check environment variables**:
```bash
docker compose -f docker-compose.prod.yml exec api-gateway printenv | grep SECRET
```

**Check SSL certificate**:
```bash
docker compose -f docker-compose.prod.yml exec main-app ls -la /run/secrets/
```

**Rebuild containers**:
```bash
docker compose -f docker-compose.prod.yml build --no-cache api-gateway main-app
docker compose -f docker-compose.prod.yml up -d --force-recreate api-gateway main-app
```

### API Still Returns 502?

**Check Nginx**:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

**Verify backend is listening**:
```bash
docker compose -f docker-compose.prod.yml exec api-gateway curl http://localhost:3000/health
```

### Database Connection Issues?

**Check PostgreSQL**:
```bash
docker compose -f docker-compose.prod.yml exec postgres pg_isready
```

**Check SSL files**:
```bash
ls -la /opt/kevinalthaus/secrets/
```

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `DEPLOY-NOW.sh` | Quick one-command deployment script |
| `deploy-webhook.js` | HTTP webhook server for remote deployment |
| `WEBHOOK-DEPLOYMENT.md` | Full webhook setup guide |
| `.github/workflows/deploy-production.yml` | GitHub Actions workflow |
| `DEPLOYMENT-STATUS.md` | Detailed current status |
| `PRODUCTION-READY.md` | Complete production guide |
| `docker-compose.prod.yml` | Container orchestration (with fixes) |
| `config/config.production.js` | Application config (with fixes) |

---

## 🎯 Recommended Approach

**For first deployment** (while SSH is blocked):
1. Wait for SSH access to be restored OR
2. Access server via console/VPN
3. Run: `cd /opt/kevinalthaus && ./DEPLOY-NOW.sh`

**For future deployments**:
1. Set up webhook server (Method 3)
2. Deploy from anywhere with: `curl -X POST ...`

**For automated CI/CD**:
1. Set up GitHub Actions (Method 4)
2. Auto-deploy on every push to main

---

## 🔒 Security Notes

- **SSH Keys**: Keep `~/.ssh/id_kevin_prod` secure
- **Webhook Secret**: Keep `DEPLOY_WEBHOOK_SECRET` secure
- **GitHub Secrets**: Only admins can view `PROD_SSH_KEY`
- **Firewall**: Only HTTP/HTTPS are publicly accessible
- **Rate Limiting**: Webhook has 3 req/min limit per IP

---

## 📞 Support

All fixes are committed: `75d2499`, `6f25c21`, `4fe3e26`

The deployment is **ready to go** - just needs to be triggered!

Choose the method that works best for your current access situation.
