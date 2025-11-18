#!/bin/bash
# Fix admin API routing in nginx

echo "Adding /admin/api/ proxy configuration..."

# Create a backup (outside sites-enabled to avoid nginx loading it)
sudo cp /etc/nginx/sites-enabled/kevinalthaus.com /tmp/kevinalthaus.com.backup

# Add the /admin/api/ location before the /admin location
# This uses sed to insert the new location block before the "# Admin interface" comment
sudo sed -i '/# Admin interface/i\    # Admin API requests - proxy to API Gateway\n    location /admin/api/ {\n        proxy_pass http://localhost:4000/api/;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection '"'"'upgrade'"'"';\n        proxy_set_header Host $host;\n        proxy_cache_bypass $http_upgrade;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n    }\n' /etc/nginx/sites-enabled/kevinalthaus.com

echo "Testing nginx configuration..."
if sudo nginx -t; then
    echo "Reloading nginx..."
    sudo systemctl reload nginx
    echo "✓ Admin API routing fixed!"
else
    echo "✗ Nginx configuration test failed. Restoring backup..."
    sudo cp /tmp/kevinalthaus.com.backup /etc/nginx/sites-enabled/kevinalthaus.com
    exit 1
fi
