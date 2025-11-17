/**
 * Production Environment Configuration
 *
 * This file contains non-secret configuration values for the production environment.
 * Secrets (passwords, API keys, tokens) should be stored in .env files.
 *
 * @see config/index.ts for the configuration loader
 * @see .env.example for required secrets
 */

module.exports = {
  // Environment
  NODE_ENV: 'production',
  VERSION: '1.0.0',
  DEPLOY_ENV: 'production',
  SENTRY_RELEASE: '1.0.0',

  // Service Configuration
  API_GATEWAY_PORT: 3000, // Internal container port (mapped to 4000 externally)
  API_GATEWAY_HOST: '0.0.0.0',
  API_GATEWAY_URL: 'http://api-gateway:3000', // Internal Docker network

  MAIN_APP_PORT: 3001,
  MAIN_APP_HOST: '0.0.0.0',
  MAIN_APP_URL: 'http://main-app:3001', // Internal Docker network

  FRONTEND_PORT: 3000,
  FRONTEND_URL: 'https://kevinalthaus.com',

  ADMIN_PORT: 3002,
  ADMIN_URL: 'https://kevinalthaus.com/admin',

  PYTHON_SERVICE_PORT: 8000,
  PYTHON_SERVICE_URL: 'http://python-service:8000',

  PLUGIN_ENGINE_PORT: 3004,
  PLUGIN_ENGINE_URL: 'http://plugin-engine:3004',

  // Database Configuration
  POSTGRES_HOST: 'postgres', // Docker service name
  POSTGRES_PORT: 5432,
  POSTGRES_DB: 'kevinalthaus',
  POSTGRES_USER: 'postgres',
  PGSSLMODE: 'verify-full', // Enforce SSL with certificate validation
  PGSSLROOTCERT: '/run/secrets/postgres_ca', // Docker secret path
  SKIP_DB_HEALTHCHECK: false,

  // Redis Configuration
  REDIS_HOST: 'redis', // Docker service name
  REDIS_PORT: 6379,
  REDIS_URL: 'redis://redis:6379',

  // Vault Configuration
  VAULT_ADDR: 'http://vault:8200',
  VAULT_NAMESPACE: '',
  VAULT_AUTH_METHOD: 'approle',
  VAULT_MAX_RETRIES: 3,
  VAULT_TIMEOUT: 10000,
  VAULT_K8S_ROLE: '',

  // CORS Configuration
  CORS_ORIGIN: [
    'https://kevinalthaus.com'
  ],
  CORS_CREDENTIALS: true,
  ADMIN_ALLOWED_ORIGINS: [
    'https://kevinalthaus.com'
  ],

  // Cookie Configuration
  COOKIE_SAMESITE: 'lax',

  // Logging Configuration
  LOG_LEVEL: 'info',
  LOG_FORMAT: 'json',
  ENABLE_REQUEST_LOGGING: true,
  QUERY_LOG_SAMPLE_RATE: 5, // Sample 5% of queries in production

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: 900000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,
  RATE_LIMIT_BYPASS_E2E: false,
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
  ENABLE_API_DOCS: false, // Disabled in production
  ENABLE_METRICS: true,

  // Security Headers
  HELMET_CSP_ENABLED: true, // Enabled in production
  HELMET_HSTS_ENABLED: true, // Enabled in production

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
  SENTRY_ENVIRONMENT: 'production',
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
  // FRONTEND_PORT: Port for Vite build (defaults to 3000 in production)
  // API_GATEWAY_URL: Proxy target for /api requests in Vite (http://api-gateway:4000)
  // VITE_PROXY_SECURE: Whether to verify SSL certificates for proxy requests (true in production)
  VITE_PROXY_SECURE: true
};
