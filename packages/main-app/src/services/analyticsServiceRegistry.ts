import type { Logger } from '@monorepo/shared';
import { AnalyticsService } from './AnalyticsService';
import { pool } from '../db';

type MinimalLogger = Pick<Logger, 'error'>;

const analyticsService = new AnalyticsService(pool);

let initializationPromise: Promise<void> | null = null;

async function initializeAnalyticsService(logger?: MinimalLogger): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = analyticsService.initialize().catch((error) => {
      logger?.error?.('Failed to initialize AnalyticsService', error);
      initializationPromise = null;
      throw error;
    });
  }

  return initializationPromise;
}

export { analyticsService, initializeAnalyticsService };
