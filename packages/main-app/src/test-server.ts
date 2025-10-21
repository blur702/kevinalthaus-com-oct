// Simple test server without any dependencies
import * as http from 'http';

const PORT = process.env.PORT || 3001;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', service: 'main-app-simple' }));
  } else if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Simple test server running' }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found', message: `Route ${req.url} not found`, statusCode: 404 }));
  }
});

/* eslint-disable no-console */
server.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
}).on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

// Graceful shutdown handler
function gracefulShutdown(signal: string): void {
  console.log(`Received ${signal}. Shutting down test server...`);
  server.close(() => {
    console.log('Test server closed');
    process.exit(0);
  });
}
/* eslint-enable no-console */

// Register shutdown handlers for both SIGINT and SIGTERM
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));