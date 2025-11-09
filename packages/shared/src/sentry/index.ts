import * as Sentry from '@sentry/react';

export interface SentryConfig {
  dsn: string;
  environment?: string;
  release?: string;
  sampleRate?: number;
  tracesSampleRate?: number;
  replaysSessionSampleRate?: number;
  replaysOnErrorSampleRate?: number;
  sendDefaultPii?: boolean;
  enabled?: boolean;
}

/**
 * Initialize Sentry for React applications
 * @param config - Sentry configuration options
 */
export function initializeSentry(config: SentryConfig): void {
  const {
    dsn,
    environment = process.env.NODE_ENV || 'development',
    release = process.env.VITE_APP_VERSION || 'unknown',
    sampleRate = 1.0,
    tracesSampleRate = 0.1,
    replaysSessionSampleRate = 0.1,
    replaysOnErrorSampleRate = 1.0,
    // Default privacy-safe; allow override via env flag SENTRY_SEND_DEFAULT_PII
    sendDefaultPii = undefined,
    enabled = process.env.NODE_ENV === 'production',
  } = config;

  // Don't initialize if disabled or no DSN provided
  if (!enabled || !dsn) {
    console.info('[Sentry] Not initialized (disabled or missing DSN)');
    return;
  }

  // Determine final PII flag
  const piiEnv = String(process.env.SENTRY_SEND_DEFAULT_PII || '').toLowerCase();
  const sendDefaultPiiFinal =
    typeof sendDefaultPii === 'boolean'
      ? sendDefaultPii
      : piiEnv === 'true' || piiEnv === '1';

  Sentry.init({
    dsn,
    environment,
    release,

    // Set sample rate for error events
    sampleRate,

    // Performance Monitoring
    tracesSampleRate,

    // Session Replay
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
      Sentry.browserTracingIntegration(),
    ],

    // Session replay sampling
    replaysSessionSampleRate,
    replaysOnErrorSampleRate,

    // Privacy settings
    sendDefaultPii: sendDefaultPiiFinal,

    // Before send hook to filter sensitive data
    beforeSend(event) {
      // Filter out sensitive information from URLs
      if (event.request?.url) {
        event.request.url = event.request.url.replace(/([?&])(token|password|secret|key)=[^&]*/gi, '$1$2=REDACTED');
      }

      // Filter out localStorage/sessionStorage
      if (event.contexts?.browser) {
        delete event.contexts.browser;
      }

      return event;
    },

    // Ignore certain errors
    ignoreErrors: [
      // Browser extension errors
      /^Non-Error promise rejection captured/i,
      /^ResizeObserver loop/i,
      // Network errors that are not actionable
      'Network request failed',
      'NetworkError',
      'Failed to fetch',
      // Optionally ignore specific Minified React errors by code (env: SENTRY_IGNORE_MINIFIED_REACT_CODES)
      ...(process.env.SENTRY_IGNORE_MINIFIED_REACT_CODES
        ? process.env.SENTRY_IGNORE_MINIFIED_REACT_CODES.split(",")
            .map((c) => c.trim())
            .filter((c) => /^\d+$/.test(c)) // Only accept numeric codes to prevent ReDoS
            .map((c) => new RegExp(`^Minified React error #${c}:`))
        : []),
    ],
    // Denylist for URLs we don't want to track
    denyUrls: [
      // Browser extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^moz-extension:\/\//i,
    ],
  });

  console.info(`[Sentry] Initialized for environment: ${environment}`);
}

/**
 * Create an error boundary component for React
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

/**
 * Capture an exception manually
 */
export const captureException = Sentry.captureException;

/**
 * Capture a message manually
 */
export const captureMessage = Sentry.captureMessage;

/**
 * Set user context for Sentry
 */
export const setSentryUser = Sentry.setUser;

/**
 * Add breadcrumb for debugging
 */
export const addBreadcrumb = Sentry.addBreadcrumb;

/**
 * Get current Sentry scope
 */
export const getCurrentScope = Sentry.getCurrentScope;

/**
 * Wrap component with profiling
 */
export const withProfiler = Sentry.withProfiler;
