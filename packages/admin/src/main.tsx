import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import App from './App';
import { adminTheme } from './theme';
import { initializeSentry, SentryErrorBoundary } from '@monorepo/shared';
import './error-boundary.css';

// Initialize Sentry as early as possible
const enableSentry = Boolean(
  import.meta.env.PROD ||
    String(import.meta.env.VITE_ENABLE_SENTRY || '').toLowerCase() === 'true' ||
    String(import.meta.env.VITE_ENABLE_SENTRY || '') === '1'
);

initializeSentry({
  dsn: import.meta.env.VITE_SENTRY_DSN || '',
  environment: import.meta.env.MODE || 'development',
  release: import.meta.env.VITE_APP_VERSION || 'unknown',
  enabled: enableSentry,
  sendDefaultPii: true,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error(
    'Failed to find the root element. Please ensure there is an element with id="root" in your HTML.'
  );
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <SentryErrorBoundary
      fallback={({ error, resetError }: { error: unknown; componentStack: string; eventId: string; resetError: () => void }) => (
        <div className="error-boundary">
          <h1>Something went wrong</h1>
          <p>We've been notified and are working on a fix.</p>
          <details className="error-details">
            {error instanceof Error ? error.toString() : String(error)}
          </details>
          <button
            onClick={resetError}
            className="error-retry-btn"
          >
            Try again
          </button>
        </div>
      )}
    >
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ThemeProvider theme={adminTheme}>
          <CssBaseline />
          <App />
        </ThemeProvider>
      </BrowserRouter>
    </SentryErrorBoundary>
  </React.StrictMode>
);
