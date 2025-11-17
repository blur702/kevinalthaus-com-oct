/**
 * Development Environment Configuration
 *
 * This file contains non-secret configuration values for the development environment.
 * Secrets (passwords, API keys, tokens) should be stored in .env files.
 *
 * @see config/index.ts for the configuration loader
 * @see .env.example for required secrets
 */

module.exports = {
  // Environment
  NODE_ENV: 'development',
  VERSION: '1.0.0',
  DEPLOY_ENV: 'local',
  SENTRY_RELEASE: '1.0.0',

  // Service Configuration
  API_GATEWAY_PORT: 3000,
  API_GATEWAY_HOST: 'localhost',
  API_GATEWAY_URL: 'http://localhost:3000',

  MAIN_APP_PORT: 3003,
  MAIN_APP_HOST: 'localhost',
  MAIN_APP_URL: 'http://localhost:3003',

  FRONTEND_PORT: 3001,
  FRONTEND_URL: 'http://localhost:3001',

  ADMIN_PORT: 3002,
  ADMIN_URL: 'http://localhost:3002',

  PYTHON_SERVICE_PORT: 8000,
  PYTHON_SERVICE_URL: 'http://localhost:8000',

  PLUGIN_ENGINE_PORT: 3004,
  PLUGIN_ENGINE_URL: 'http://localhost:3004',

  // Database Configuration
  POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: 5432,
  POSTGRES_DB: 'kevinalthaus',
  POSTGRES_USER: 'postgres',
  PGSSLMODE: 'require', // SSL required but certificate not verified (rejectUnauthorized: false)
  PGSSLROOTCERT: '', // Empty for development (only needed for 'verify-ca' or 'verify-full' modes)
  SKIP_DB_HEALTHCHECK: false,

  // Redis Configuration
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_URL: 'redis://localhost:6379',

  // Vault Configuration
  VAULT_ADDR: 'http://localhost:8200',
  VAULT_NAMESPACE: '',
  VAULT_AUTH_METHOD: 'token',
  VAULT_MAX_RETRIES: 3,
  VAULT_TIMEOUT: 10000,
  VAULT_K8S_ROLE: '',

  // CORS Configuration
  CORS_ORIGIN: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003'
  ],
  CORS_CREDENTIALS: true,
  ADMIN_ALLOWED_ORIGINS: [
    'http://localhost:3003',
    'https://localhost:3003'
  ],

  // Cookie Configuration
  COOKIE_SAMESITE: 'lax',

  // Logging Configuration
  LOG_LEVEL: 'info',
  LOG_FORMAT: 'json',
  ENABLE_REQUEST_LOGGING: true,
  QUERY_LOG_SAMPLE_RATE: 10,

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: 900000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,
  RATE_LIMIT_BYPASS_E2E: true,
  DISABLE_AUTH_RATE_LIMIT: false,
  E2E_TESTING: false,

  // File Upload Configuration
  UPLOAD_MAX_SIZE: 10485760, // 10MB
  UPLOAD_DIRECTORY: './uploads',
  UPLOAD_QUARANTINE_DIR: './uploads_quarantine',
  ALLOWED_FILE_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf'
  ],

  // Plugin Configuration
  PLUGIN_UPLOAD_MAX_SIZE: 52428800, // 50MB
  PLUGIN_DIRECTORY: './plugins',
  PLUGIN_SSDD_PATH: '',

  // Email Configuration
  SMTP_FROM_EMAIL: 'noreply@kevinalthaus.com',
  SMTP_FROM_NAME: 'Kevin Althaus',
  BREVO_API_KEY_VAULT_PATH: 'secret/email/brevo',

  // Feature Flags
  ENABLE_PLUGIN_SYSTEM: true,
  ENABLE_THEME_SYSTEM: true,
  ENABLE_API_DOCS: true,
  ENABLE_METRICS: true,

  // Security Headers
  HELMET_CSP_ENABLED: false, // Disabled in development
  HELMET_HSTS_ENABLED: false, // Disabled in development

  // Analytics Configuration
  ANALYTICS_ENABLED: true,
  ANALYTICS_IP_ANONYMIZE: true,
  ANALYTICS_TRACK_AUTHENTICATED: true,
  ANALYTICS_EXCLUDED_PATHS: [
    '/health',
    '/health/live',
    '/health/ready'
  ],

  // Monitoring Configuration
  SENTRY_ENABLED: true,
  SENTRY_ENVIRONMENT: 'development',
  SENTRY_TRACES_SAMPLE_RATE: 0.05,
  SENTRY_ERROR_SAMPLE_RATE: 1.0,
  SENTRY_SEND_DEFAULT_PII: false,

  // Performance Configuration
  NODE_OPTIONS: '--max-old-space-size=4096',
  UV_THREADPOOL_SIZE: 4,

  // Timeouts and Health Checks
  HEALTH_CACHE_MS: 5000,
  SHUTDOWN_TIMEOUT: 30000,
  SENTRY_FLUSH_TIMEOUT_MS: 2000,

  // Password Reset Configuration
  PASSWORD_RESET_TOKEN_EXPIRY_MINUTES: 30,
  PASSWORD_HISTORY_LIMIT: 3,

  // JWT Configuration
  JWT_EXPIRES_IN: '7d',

  // Trust Proxy
  TRUST_PROXY: 1,

  // Vite Configuration (build-time)
  // FRONTEND_PORT: Port for Vite dev server (defaults to 3001)
  // API_GATEWAY_URL: Proxy target for /api requests in Vite (http://localhost:3000)
  // VITE_PROXY_SECURE: Whether to verify SSL certificates for proxy requests (false for local dev)
  VITE_PROXY_SECURE: false
};
