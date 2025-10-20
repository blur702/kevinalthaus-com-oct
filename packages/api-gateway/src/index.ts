import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'api-gateway',
    timestamp: new Date().toISOString() 
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Kevin Althaus API Gateway',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Proxy to main app
app.use('/api/main', createProxyMiddleware({
  target: process.env.MAIN_APP_URL || 'http://localhost:3001',
  changeOrigin: true,
  pathRewrite: {
    '^/api/main': '/'
  }
}));

// Proxy to python service
app.use('/api/python', createProxyMiddleware({
  target: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
  changeOrigin: true,
  pathRewrite: {
    '^/api/python': '/'
  }
}));

export default app;