import app from './index';
import { logger } from '@monorepo/shared';

const PORT = process.env.PORT || 3001;

// Start server
app.listen(PORT, () => {
  logger.info(`Main app server running on port ${PORT}`);
});