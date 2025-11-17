# 🪝 Webhook-Based Deployment

This provides an alternative deployment method using a simple HTTP webhook that can be triggered remotely.

## Setup (On Server)

### 1. Start the Webhook Server

```bash
cd /opt/kevinalthaus

# Generate a secure token
export DEPLOY_WEBHOOK_SECRET=$(openssl rand -hex 32)
echo "DEPLOY_WEBHOOK_SECRET=$DEPLOY_WEBHOOK_SECRET" >> .env.local

# Start the webhook server (runs in foreground)
node deploy-webhook.js
```

Or run it as a systemd service for auto-start:

```bash
# Create systemd service
sudo tee /etc/systemd/system/deploy-webhook.service > /dev/null <<EOF
[Unit]
Description=Deployment Webhook Server
After=network.target

[Service]
Type=simple
User=kevin
WorkingDirectory=/opt/kevinalthaus
Environment=NODE_ENV=production
EnvironmentFile=/opt/kevinalthaus/.env.local
ExecStart=/usr/bin/node /opt/kevinalthaus/deploy-webhook.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Start and enable service
sudo systemctl daemon-reload
sudo systemctl enable deploy-webhook
sudo systemctl start deploy-webhook

# Check status
sudo systemctl status deploy-webhook
```

### 2. Configure Firewall

```bash
# Allow webhook port (3333)
sudo ufw allow 3333/tcp

# Or use a different port
export DEPLOY_WEBHOOK_PORT=8080
sudo ufw allow 8080/tcp
```

### 3. Optional: Add Nginx Proxy

For HTTPS access through Nginx:

```nginx
# Add to Nginx config
location /deploy-webhook {
    proxy_pass http://localhost:3333/deploy;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

Then trigger via: `https://kevinalthaus.com/deploy-webhook`

## Triggering Deployment (Remotely)

Once the webhook server is running:

```bash
# Get the secret token (from server .env.local)
TOKEN="your-secret-token-here"

# Trigger deployment
curl -X POST http://kevinalthaus.com:3333/deploy \
  -H "Authorization: Bearer $TOKEN"

# Or via HTTPS if Nginx proxy is configured
curl -X POST https://kevinalthaus.com/deploy-webhook \
  -H "Authorization: Bearer $TOKEN"
```

Expected response:
```json
{
  "success": true,
  "message": "Deployment completed successfully",
  "timestamp": "2025-11-17T22:30:00.000Z"
}
```

## Security Features

- **Authentication**: Requires secret token in Authorization header
- **Rate Limiting**: Max 3 requests per minute per IP
- **HTTPS**: Can run behind Nginx for encrypted connections
- **IP Filtering**: Can be restricted by firewall rules

## Environment Variables

- `DEPLOY_WEBHOOK_PORT` - Port to listen on (default: 3333)
- `DEPLOY_WEBHOOK_SECRET` - Secret token for authentication (required)

## What It Does

When triggered, the webhook:
1. Pulls latest code: `git pull origin main`
2. Restarts containers: `docker compose -f docker-compose.prod.yml up -d --force-recreate api-gateway main-app`
3. Waits 10 seconds for startup
4. Returns deployment status

## Logs

View webhook server logs:
```bash
# If running as systemd service
sudo journalctl -u deploy-webhook -f

# If running manually
# Logs appear in the terminal where node deploy-webhook.js was run
```

## Advantages

- ✅ Can be triggered from anywhere with internet access
- ✅ No need for SSH access from remote location
- ✅ Can be integrated with GitHub webhooks
- ✅ Simple HTTP API, works with curl, scripts, or CI/CD
- ✅ Rate limited to prevent abuse

## Disadvantages

- ⚠️ Requires initial SSH access to set up
- ⚠️ Opens another port (mitigated by firewall + auth)
- ⚠️ Secret token must be kept secure

## Alternative: GitHub Webhook Integration

You can configure GitHub to automatically trigger deployment on push:

1. Start webhook server with specific path:
   ```javascript
   // Modify deploy-webhook.js to accept GitHub webhooks
   if (req.url === '/github-webhook') {
     // Verify GitHub signature
     // Trigger deployment
   }
   ```

2. Add webhook in GitHub repo settings:
   - URL: `http://kevinalthaus.com:3333/github-webhook`
   - Secret: Your webhook secret
   - Events: Push to main branch

This enables automatic deployment on every git push!
