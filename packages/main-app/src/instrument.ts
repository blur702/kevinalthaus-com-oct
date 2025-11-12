// Sentry instrumentation - MUST be imported before any other modules
// This file initializes Sentry and exports the configuration status
import * as Sentry from '@sentry/node';

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

function parseSampleRate(value: string | undefined, defaultValue: number): number {
  if (!value) {
    return defaultValue;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : defaultValue;
}

// Initialize Sentry immediately when this module is loaded
const dsn = (process.env.SENTRY_DSN || '').trim();
const enabled = Boolean(dsn) && parseBoolean(process.env.SENTRY_ENABLED, true);

if (enabled) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || process.env.VERSION || 'main-app@unknown',
    integrations: [Sentry.expressIntegration()],
    tracesSampleRate: parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.05),
    sampleRate: parseSampleRate(process.env.SENTRY_ERROR_SAMPLE_RATE, 1.0),
    sendDefaultPii: parseBoolean(process.env.SENTRY_SEND_DEFAULT_PII, false),
  });
}

export const isSentryEnabled = enabled;
export { Sentry };
