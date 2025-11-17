import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import developmentConfig from '../../config/config.development.js';
import productionConfig from '../../config/config.production.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Vite reads configuration at build time. Changes require rebuilding dev server or production bundle.
const appConfig = process.env.NODE_ENV === 'production' ? productionConfig : developmentConfig;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Upload source maps to Sentry on production builds (validate required env vars)
    (() => {
      const isProd = process.env.NODE_ENV === 'production';
      if (!isProd) {
        return undefined;
      }
      const required = ['SENTRY_ORG', 'SENTRY_PROJECT', 'SENTRY_AUTH_TOKEN'];
      const missing = required.filter((k) => !process.env[k]);
      if (missing.length > 0) {
        console.warn(
          `Sentry plugin disabled: missing env vars ${missing.join(', ')}`
        );
        return undefined;
      }
      return sentryVitePlugin({
        org: process.env.SENTRY_ORG!,
        project: process.env.SENTRY_PROJECT!,
        authToken: process.env.SENTRY_AUTH_TOKEN!,
        release: {
          name: appConfig.VERSION || '1.0.0',
        },
        sourcemaps: {
          assets: './dist/**',
        },
        telemetry: false,
      });
    })(),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@monorepo/shared': resolve(__dirname, '../shared/src/browser.ts'),
    },
  },
  server: {
    // Explicit port configuration with safe fallback
    port: appConfig.FRONTEND_PORT ?? (process.env.NODE_ENV === 'production' ? 3000 : 3001),
    strictPort: true,
    proxy: {
      '/api': {
        // Proxy target for API requests (see config files for expected values per environment)
        target: appConfig.API_GATEWAY_URL ?? 'http://localhost:3000',
        changeOrigin: true,
        // Explicit SSL verification setting (false for local dev, true for production)
        secure: appConfig.VITE_PROXY_SECURE ?? false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
