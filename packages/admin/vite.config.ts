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
    // Upload source maps to Sentry on production builds
    process.env.NODE_ENV === 'production' && process.env.SENTRY_AUTH_TOKEN
      ? sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          release: {
            name: process.env.VITE_APP_VERSION || '1.0.0',
          },
          sourcemaps: {
            assets: './dist/**',
          },
          telemetry: false,
        })
      : undefined,
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@monorepo/shared': resolve(__dirname, '../shared/src/browser.ts'),
    },
  },
  server: {
    host: '0.0.0.0', // Listen on all network interfaces (IPv4 and IPv6)
    port: 3002,
    strictPort: true,
    proxy: {
      '/api': {
        // Point to API Gateway in development
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: process.env.NODE_ENV === 'production' || process.env.VITE_PROXY_SECURE === 'true',
        cookieDomainRewrite: 'localhost',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  optimizeDeps: {
    exclude: ['mock-aws-s3', 'aws-sdk', 'nock', 'bcrypt', 'sanitize-html', 'node-sql-parser'],
  },
});
