#!/bin/bash
# Fix nginx API proxy configuration

echo "Fixing nginx configuration to preserve /api prefix..."

# Fix the proxy_pass configuration
sudo sed -i 's|proxy_pass http://localhost:4000/;|proxy_pass http://localhost:4000;|' /etc/nginx/sites-enabled/kevinalthaus.com

# Test nginx configuration
echo "Testing nginx configuration..."
if sudo nginx -t; then
    echo "Nginx configuration is valid. Reloading..."
    sudo systemctl reload nginx
    echo "✓ Nginx reloaded successfully"
else
    echo "✗ Nginx configuration test failed"
    exit 1
fi
