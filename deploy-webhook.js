#!/usr/bin/env node

/**
 * Simple HTTP webhook server for triggering deployments
 *
 * Usage:
 *   1. On server: node deploy-webhook.js
 *   2. From remote: curl -X POST http://kevinalthaus.com:3333/deploy -H "Authorization: Bearer YOUR_SECRET_TOKEN"
 *
 * Security:
 *   - Set DEPLOY_WEBHOOK_SECRET environment variable
 *   - Only accepts POST requests with correct Authorization header
 *   - Rate limited to prevent abuse
 */

const http = require('http');
const { execSync } = require('child_process');
const crypto = require('crypto');

const PORT = process.env.DEPLOY_WEBHOOK_PORT || 3333;
const SECRET = process.env.DEPLOY_WEBHOOK_SECRET || crypto.randomBytes(32).toString('hex');
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 3;

// Simple in-memory rate limiting
const requestCounts = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const requests = requestCounts.get(ip) || [];

  // Clean old requests
  const recentRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW_MS);

  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  recentRequests.push(now);
  requestCounts.set(ip, recentRequests);
  return true;
}

function deploy() {
  console.log('[DEPLOY] Starting deployment...');

  try {
    // Pull latest code
    console.log('[DEPLOY] Pulling latest code...');
    execSync('git pull origin main', { cwd: '/opt/kevinalthaus', stdio: 'inherit' });

    // Restart containers
    console.log('[DEPLOY] Restarting containers...');
    execSync(
      'docker compose -f docker-compose.prod.yml up -d --force-recreate api-gateway main-app',
      { cwd: '/opt/kevinalthaus', stdio: 'inherit' }
    );

    // Wait for startup
    console.log('[DEPLOY] Waiting for services to start...');
    execSync('sleep 10', { stdio: 'inherit' });

    // Check status
    console.log('[DEPLOY] Checking container status...');
    const status = execSync(
      'docker compose -f docker-compose.prod.yml ps --format json',
      { cwd: '/opt/kevinalthaus', encoding: 'utf8' }
    );

    console.log('[DEPLOY] Deployment completed successfully!');
    return { success: true, status: JSON.parse(status) };
  } catch (error) {
    console.error('[DEPLOY] Deployment failed:', error.message);
    return { success: false, error: error.message };
  }
}

const server = http.createServer((req, res) => {
  const ip = req.socket.remoteAddress;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Only accept POST to /deploy
  if (req.method !== 'POST' || req.url !== '/deploy') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  // Check rate limit
  if (!checkRateLimit(ip)) {
    console.warn(`[WEBHOOK] Rate limit exceeded for ${ip}`);
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }));
    return;
  }

  // Verify authorization
  const authHeader = req.headers.authorization;
  const expectedAuth = `Bearer ${SECRET}`;

  if (!authHeader || authHeader !== expectedAuth) {
    console.warn(`[WEBHOOK] Unauthorized deployment attempt from ${ip}`);
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  // Trigger deployment
  console.log(`[WEBHOOK] Deployment triggered by ${ip}`);
  const result = deploy();

  if (result.success) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      message: 'Deployment completed successfully',
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: result.error,
      timestamp: new Date().toISOString()
    }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[WEBHOOK] Deployment webhook server running on port ${PORT}`);
  console.log(`[WEBHOOK] Secret token: ${SECRET}`);
  console.log(`[WEBHOOK] Trigger deployment with: curl -X POST http://kevinalthaus.com:${PORT}/deploy -H "Authorization: Bearer ${SECRET}"`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[WEBHOOK] Shutting down...');
  server.close(() => {
    console.log('[WEBHOOK] Server closed');
    process.exit(0);
  });
});
