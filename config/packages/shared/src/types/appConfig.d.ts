export interface AppConfig {
    NODE_ENV: string;
    VERSION: string;
    DEPLOY_ENV: string;
    SENTRY_RELEASE: string;
    API_GATEWAY_PORT: number;
    API_GATEWAY_HOST: string;
    API_GATEWAY_URL: string;
    MAIN_APP_PORT: number;
    MAIN_APP_HOST: string;
    MAIN_APP_URL: string;
    FRONTEND_PORT: number;
    FRONTEND_URL: string;
    ADMIN_PORT: number;
    ADMIN_URL: string;
    PYTHON_SERVICE_PORT: number;
    PYTHON_SERVICE_URL: string;
    PLUGIN_ENGINE_PORT: number;
    PLUGIN_ENGINE_URL: string;
    POSTGRES_HOST: string;
    POSTGRES_PORT: number;
    POSTGRES_DB: string;
    POSTGRES_USER: string;
    POSTGRES_PASSWORD?: string;
    PGSSLMODE: string;
    PGSSLROOTCERT: string;
    SKIP_DB_HEALTHCHECK: boolean;
    REDIS_HOST: string;
    REDIS_PORT: number;
    REDIS_URL: string;
    VAULT_ADDR: string;
    VAULT_NAMESPACE: string;
    VAULT_AUTH_METHOD: string;
    VAULT_MAX_RETRIES: number;
    VAULT_TIMEOUT: number;
    VAULT_K8S_ROLE: string;
    CORS_ORIGIN: string[];
    CORS_CREDENTIALS: boolean;
    ADMIN_ALLOWED_ORIGINS: string[];
    COOKIE_SAMESITE: 'lax' | 'strict' | 'none';
    LOG_LEVEL: string;
    LOG_FORMAT: 'json' | 'text';
    ENABLE_REQUEST_LOGGING: boolean;
    QUERY_LOG_SAMPLE_RATE: number;
    RATE_LIMIT_WINDOW_MS: number;
    RATE_LIMIT_MAX_REQUESTS: number;
    RATE_LIMIT_BYPASS_E2E: boolean;
    DISABLE_AUTH_RATE_LIMIT: boolean;
    E2E_TESTING: boolean;
    UPLOAD_MAX_SIZE: number;
    UPLOAD_DIRECTORY: string;
    UPLOAD_QUARANTINE_DIR: string;
    ALLOWED_FILE_TYPES: string[];
    PLUGIN_UPLOAD_MAX_SIZE: number;
    PLUGIN_DIRECTORY: string;
    PLUGIN_SSDD_PATH: string;
    SMTP_FROM_EMAIL: string;
    SMTP_FROM_NAME: string;
    BREVO_API_KEY_VAULT_PATH: string;
    ENABLE_PLUGIN_SYSTEM: boolean;
    ENABLE_THEME_SYSTEM: boolean;
    ENABLE_API_DOCS: boolean;
    ENABLE_METRICS: boolean;
    HELMET_CSP_ENABLED: boolean;
    HELMET_HSTS_ENABLED: boolean;
    ANALYTICS_ENABLED: boolean;
    ANALYTICS_IP_ANONYMIZE: boolean;
    ANALYTICS_TRACK_AUTHENTICATED: boolean;
    ANALYTICS_EXCLUDED_PATHS: string[];
    SENTRY_ENABLED: boolean;
    SENTRY_DSN?: string;
    SENTRY_ENVIRONMENT: string;
    SENTRY_TRACES_SAMPLE_RATE: number;
    SENTRY_ERROR_SAMPLE_RATE: number;
    SENTRY_SEND_DEFAULT_PII: boolean;
    NODE_OPTIONS: string;
    UV_THREADPOOL_SIZE: number;
    HEALTH_CACHE_MS: number;
    SHUTDOWN_TIMEOUT: number;
    SENTRY_FLUSH_TIMEOUT_MS: number;
    PASSWORD_RESET_TOKEN_EXPIRY_MINUTES: number;
    PASSWORD_HISTORY_LIMIT: number;
    JWT_EXPIRES_IN: string;
    /**
     * JWT signing secret used for access token authentication.
     * This secret is used to sign and verify JWT access tokens.
     * Must be a strong, randomly generated value (e.g., via `openssl rand -base64 32`).
     * Optional in dev configs (loaded from .env at runtime).
     */
    JWT_SECRET?: string;
    /**
     * JWT signing secret used for refresh token authentication.
     * This secret is used to sign and verify JWT refresh tokens.
     * Must be a strong, randomly generated value (e.g., via `openssl rand -base64 32`).
     * Should be different from JWT_SECRET for enhanced security.
     * Optional in dev configs (loaded from .env at runtime).
     */
    JWT_REFRESH_SECRET?: string;
    /**
     * Trust proxy configuration for Express.js.
     * - number: Number of proxy hops to trust (e.g., 1 for a single reverse proxy like nginx)
     * - string: IP address, subnet (CIDR notation), or hostname to trust (e.g., 'loopback', '10.0.0.0/8')
     * See Express.js trust proxy documentation for more details.
     */
    TRUST_PROXY: number | string;
    VITE_PROXY_SECURE: boolean;
}
