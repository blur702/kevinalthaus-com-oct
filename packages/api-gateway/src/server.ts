import app from './index';
import { logger } from '@monorepo/shared';

const PORT = process.env.PORT || 3000;

// Start server
app.listen(PORT, () => {
  logger.info(`API Gateway server running on port ${PORT}`);
});