// Simple test server without any dependencies
import * as http from 'http';
import * as net from 'net';

const parsedPort = process.env.PORT ? Number(process.env.PORT) : NaN;
const PORT = !isNaN(parsedPort) && Number.isFinite(parsedPort) && parsedPort >= 1 && parsedPort <= 65535 ? parsedPort : 3001;

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', service: 'main-app-simple' }));
  } else if (url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Simple test server running' }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({ error: 'Not Found', message: `Route ${url} not found`, statusCode: 404 })
    );
  }
});

// Track active connections so we can force-close them on shutdown
const connections = new Set<net.Socket>();
server.on('connection', (conn: net.Socket) => {
  connections.add(conn);
  conn.on('close', () => {
    connections.delete(conn);
  });
});

/* eslint-disable no-console */
server
  .listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
  })
  .on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
  });

// Graceful shutdown handler
function gracefulShutdown(signal: string): void {
  console.log(`Received ${signal}. Shutting down test server...`);

  // Set timeout to force exit if server doesn't close gracefully
  const forceExitTimeout = setTimeout(() => {
    console.warn('Server did not close gracefully within 10 seconds, forcing exit');
    process.exit(1);
  }, 10000);

  // Stop accepting new connections
  server.close(() => {
    clearTimeout(forceExitTimeout);
    console.log('Test server closed cleanly');
    process.exit(0);
  });

  // Destroy any active sockets to ensure close completes
  for (const socket of connections) {
    try {
      socket.destroy();
    } catch {
      // ignore
    }
  }
}
/* eslint-enable no-console */

// Register shutdown handlers for both SIGINT and SIGTERM
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
