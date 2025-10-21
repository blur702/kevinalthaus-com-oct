import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createProxyMiddleware } from 'http-proxy-middleware';
import {
  compressionMiddleware,
  rateLimitMiddleware,
  timingMiddleware,
  securityHeadersMiddleware,
  keepAliveMiddleware,
  cacheMiddleware
} from './middleware/performance';

// Simple console logger until shared package is available
// const logger = {
//   info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
//   error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
//   warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args)
// };

const app = express();

// Performance and security middleware (order matters)
app.use(timingMiddleware);
app.use(compressionMiddleware);
app.use(rateLimitMiddleware);
app.use(helmet());
app.use(securityHeadersMiddleware);
app.use(keepAliveMiddleware);
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cache middleware for GET requests
app.use(cacheMiddleware);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'api-gateway',
    timestamp: new Date().toISOString() 
  });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    message: 'Kevin Althaus API Gateway',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Proxy to main app with optimized settings
app.use('/api/main', createProxyMiddleware({
  target: process.env.MAIN_APP_URL || 'http://localhost:4001',
  changeOrigin: true,
  pathRewrite: {
    '^/api/main': '/'
  },
  timeout: 30000,
  proxyTimeout: 30000,
  onProxyReq: (proxyReq, req) => {
    // Add forwarded headers for better security and tracing
    proxyReq.setHeader('X-Forwarded-Proto', req.protocol);
    proxyReq.setHeader('X-Forwarded-Host', req.get('Host') || '');
    proxyReq.setHeader('X-Real-IP', req.ip || '');
  }
}));

// Proxy to python service with optimized settings
app.use('/api/python', createProxyMiddleware({
  target: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
  changeOrigin: true,
  pathRewrite: {
    '^/api/python': '/'
  },
  timeout: 30000,
  proxyTimeout: 30000,
  onProxyReq: (proxyReq, req) => {
    // Add forwarded headers for better security and tracing
    proxyReq.setHeader('X-Forwarded-Proto', req.protocol);
    proxyReq.setHeader('X-Forwarded-Host', req.get('Host') || '');
    proxyReq.setHeader('X-Real-IP', req.ip || '');
  }
}));

export default app;