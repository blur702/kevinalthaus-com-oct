import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';

const app = express();
const PORT = Number(process.env.PLUGIN_ENGINE_PORT || process.env.PORT || 3004);

app.use(morgan('combined'));
app.use(helmet());
app.use(cors({ origin: '*', credentials: false }));
app.use(express.json({ limit: '256kb' }));

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

