#!/bin/bash

# Quick Deployment Script for Production Server
# Run this script when you have console/SSH access to kevinalthaus.com

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Production Deployment - kevinalthaus.com"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Change to application directory
cd /opt/kevinalthaus || {
    echo "❌ Directory /opt/kevinalthaus not found"
    exit 1
}

# Pull latest code
echo "📥 Pulling latest code from GitHub..."
git pull origin main || {
    echo "❌ Git pull failed"
    exit 1
}

echo "✅ Code updated successfully"
echo ""

# Restart api-gateway and main-app containers
echo "🔄 Restarting api-gateway and main-app containers..."
docker compose -f docker-compose.prod.yml up -d --force-recreate api-gateway main-app || {
    echo "❌ Docker compose restart failed"
    exit 1
}

echo "✅ Containers restarted"
echo ""

# Wait for services to start
echo "⏳ Waiting for services to start (15 seconds)..."
sleep 15

# Check container status
echo "📊 Container Status:"
docker compose -f docker-compose.prod.yml ps

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Deployment completed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Test the endpoints:"
echo "  Frontend: https://kevinalthaus.com"
echo "  Admin:    https://kevinalthaus.com/admin"
echo "  API:      https://kevinalthaus.com/api/health"
echo ""
echo "Check logs:"
echo "  docker compose -f docker-compose.prod.yml logs -f api-gateway"
echo "  docker compose -f docker-compose.prod.yml logs -f main-app"
