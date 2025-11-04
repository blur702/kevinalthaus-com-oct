import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@monorepo/shared': resolve(__dirname, '../shared/src/browser.ts'),
    },
  },
  server: {
    host: '0.0.0.0', // Listen on all network interfaces (IPv4 and IPv6)
    port: 3003,
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // API Gateway (exposed to host)
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
