import app from './index';
// import { logger } from '@monorepo/shared';

// Simple console logger
const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args)
};

const PORT = process.env.PORT || 4000;

// Start server
app.listen(PORT, () => {
  logger.info(`API Gateway server running on port ${PORT}`);
});