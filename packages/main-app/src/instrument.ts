// Sentry instrumentation - MUST be imported before any other modules
// This file initializes Sentry and exports the configuration status
import * as Sentry from '@sentry/node';
import { config } from '@monorepo/shared';

// Initialize Sentry immediately when this module is loaded
const dsn = (process.env.SENTRY_DSN || '').trim();
const enabled = Boolean(dsn) && config.SENTRY_ENABLED;

if (enabled) {
  Sentry.init({
    dsn,
    environment: config.SENTRY_ENVIRONMENT || config.NODE_ENV,
    release: config.SENTRY_RELEASE || `main-app@${config.VERSION}`,
    integrations: [Sentry.expressIntegration()],
    tracesSampleRate: config.SENTRY_TRACES_SAMPLE_RATE,
    sampleRate: config.SENTRY_ERROR_SAMPLE_RATE,
    sendDefaultPii: config.SENTRY_SEND_DEFAULT_PII,
  });
}

export const isSentryEnabled = enabled;
export { Sentry };
