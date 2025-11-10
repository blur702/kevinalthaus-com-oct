import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Upload source maps to Sentry on production builds (validate required env vars)
    (() => {
      const isProd = process.env.NODE_ENV === 'production';
      if (!isProd) return undefined;
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
          name: process.env.VITE_APP_VERSION || '1.0.0',
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
    port: 3001,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:3000',
        changeOrigin: true,
        secure: process.env.VITE_PROXY_SECURE === 'false' ? false : true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
