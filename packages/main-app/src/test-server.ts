// Simple test server without any dependencies
import * as http from 'http';

const PORT = process.env.PORT || 3001;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  
  if (req.url === '/health') {
    res.end(JSON.stringify({ status: 'healthy', service: 'main-app-simple' }));
  } else {
    res.end(JSON.stringify({ message: 'Simple test server running' }));
  }
});

server.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
}).on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

// Simple shutdown handler
process.on('SIGINT', () => {
  console.log('Shutting down test server...');
  server.close(() => {
    console.log('Test server closed');
    process.exit(0);
  });
});