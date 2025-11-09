/**
 * Create admin user via API
 * This script registers an admin user through the auth API endpoint
 */

const http = require('http');

const adminUser = {
  email: 'kevin@kevinalthaus.com',
  username: 'kevin',
  password: '(130Bpm)!SecurePassword2024',
  role: 'admin'
};

const data = JSON.stringify(adminUser);

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('[Create Admin User] Registering admin user...');

const req = http.request(options, (res) => {
  let responseBody = '';

  res.on('data', (chunk) => {
    responseBody += chunk;
  });

  res.on('end', () => {
    console.log(`[Create Admin User] Response status: ${res.statusCode}`);
    console.log(`[Create Admin User] Response body: ${responseBody}`);

    if (res.statusCode === 201 || res.statusCode === 200) {
      console.log('[Create Admin User] ✓ Admin user created successfully');
      process.exit(0);
    } else if (res.statusCode === 409) {
      console.log('[Create Admin User] ⚠ User already exists (this is OK)');
      process.exit(0);
    } else {
      console.error('[Create Admin User] ✗ Failed to create admin user');
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('[Create Admin User] Error:', error.message);
  console.log('[Create Admin User] Make sure the backend is running on port 3001');
  process.exit(1);
});

req.write(data);
req.end();
