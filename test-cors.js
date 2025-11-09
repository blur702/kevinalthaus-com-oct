const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,  // Test main app directly
  path: '/api/public-settings',
  method: 'GET',
  headers: {
    'Origin': 'http://localhost:3002',
  }
};

const req = http.request(options, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:');
  Object.keys(res.headers).forEach(key => {
    console.log(`  ${key}: ${res.headers[key]}`);
  });

  // Read the response body
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  res.on('end', () => {
    console.log('Body:', body);
  });
});

req.on('error', (e) => {
  console.error('Error:', e);
});

req.end();