import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';

const app = express();
const PORT = Number(process.env.PLUGIN_ENGINE_PORT || process.env.PORT || 3004);

// Internal gateway token for service-to-service authentication
const INTERNAL_GATEWAY_TOKEN = process.env.INTERNAL_GATEWAY_TOKEN;
if (!INTERNAL_GATEWAY_TOKEN && process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
  throw new Error(
    'INTERNAL_GATEWAY_TOKEN is required for plugin-engine in production. Must match the token configured in API Gateway.'
  );
}

// Middleware to verify requests come from the API gateway
function verifyInternalToken(req: express.Request, res: express.Response, next: express.NextFunction): void {
  // Skip verification in development/test if token not configured
  if (!INTERNAL_GATEWAY_TOKEN && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')) {
    next();
    return;
  }

  const providedToken = req.headers['x-internal-token'];

  if (!providedToken || providedToken !== INTERNAL_GATEWAY_TOKEN) {
    // eslint-disable-next-line no-console
    console.warn('[plugin-engine] Unauthorized direct access attempt', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(403).json({
      error: 'Forbidden',
      message: 'Direct access to this service is not allowed',
    });
    return;
  }

  next();
}

app.use(morgan('combined'));
app.use(helmet());
// CORS disabled - service is internal and protected by API gateway
// app.use(cors({ origin: '*', credentials: false }));
app.use(express.json({ limit: '256kb' }));

// Verify internal token on all requests except health checks
app.use((req, res, next) => {
  if (req.path === '/health') {
    next();
  } else {
    verifyInternalToken(req, res, next);
  }
});

// Health
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'plugin-engine' });
});

// Simple echo to validate proxy path: /plugins/*
app.all('/plugins/*', (req, res) => {
  res.json({
    message: 'Plugin Engine stub',
    method: req.method,
    path: req.path,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    body: req.body,
  });
});

app.get('/', (_req, res) => {
  res.json({ message: 'Plugin Engine', version: '1.0.0' });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[plugin-engine] listening on ${PORT}`);
});

