import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import developmentConfig from '../../config/config.development.js';
import productionConfig from '../../config/config.production.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Vite reads configuration at build time. Changes require restarting dev server or rebuilding.
const isProd = process.env.NODE_ENV === 'production';
const appConfig = isProd ? productionConfig : developmentConfig;

// https://vitejs.dev/config/
export default defineConfig({
  // Set base path for production deployment under /admin route
  base: isProd ? '/admin/' : '/',
  plugins: [
    react(),
    // Upload source maps to Sentry on production builds
    isProd && process.env.SENTRY_AUTH_TOKEN
      ? sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          release: {
            name: appConfig.VERSION || '1.0.0',
          },
          sourcemaps: {
            assets: './dist/**',
          },
          telemetry: false,
        })
      : undefined,
  ].filter(Boolean),
  publicDir: resolve(__dirname, '../../public'),
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@monorepo/shared': resolve(__dirname, '../shared/src/browser.ts'),
      '@page-builder/frontend': resolve(__dirname, '../../plugins/page-builder/frontend/src'),
    },
  },
  server: {
    host: '0.0.0.0', // Listen on all network interfaces (IPv4 and IPv6)
    port: appConfig.ADMIN_PORT || 3002,
    strictPort: true,
    proxy: {
      // Proxy theme override CSS files to main app
      '/admin-theme-overrides.css': {
        target: appConfig.MAIN_APP_URL,
        changeOrigin: true,
        secure: appConfig.VITE_PROXY_SECURE,
      },
      '/frontend-theme-overrides.css': {
        target: appConfig.MAIN_APP_URL,
        changeOrigin: true,
        secure: appConfig.VITE_PROXY_SECURE,
      },
      // Admin files need special handling - strip /api prefix
      '/api/admin/files': {
        target: appConfig.MAIN_APP_URL,
        changeOrigin: true,
        secure: appConfig.VITE_PROXY_SECURE,
        cookieDomainRewrite: 'localhost',
        rewrite: (path) => path.replace(/^\/api/, ''),
        ws: true,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('[Proxy Error]', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log(
              '[Proxy Request]',
              req.method,
              req.url,
              '->',
              `${appConfig.MAIN_APP_URL}${req.url.replace(/^\/api/, '')}`
            );
          });
        },
      },
      '/api': {
        // Point directly to Main App (bypassing gateway for reliability)
        target: appConfig.MAIN_APP_URL,
        changeOrigin: true,
        secure: appConfig.VITE_PROXY_SECURE,
        cookieDomainRewrite: 'localhost',
        ws: true,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('[Proxy Error]', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log(
              '[Proxy Request]',
              req.method,
              req.url,
              '->',
              `${appConfig.MAIN_APP_URL}${req.url}`
            );
          });
        },
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
