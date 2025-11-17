"use strict";
/**
 * Central configuration loader.
 *
 * Non-secret, environment-specific defaults live in the config/*.js files.
 * Secrets (passwords, API keys, tokens) must stay in .env files and are accessed
 * through the getSecret helper so that they are never written to source control.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.getSecret = void 0;
const REQUIRED_KEYS = [
    'API_GATEWAY_PORT',
    'API_GATEWAY_URL',
    'MAIN_APP_PORT',
    'MAIN_APP_URL',
    'FRONTEND_URL',
    'PYTHON_SERVICE_URL',
    'PLUGIN_ENGINE_URL',
    'POSTGRES_HOST',
    'POSTGRES_PORT',
    'POSTGRES_DB',
    'POSTGRES_USER',
    'REDIS_HOST',
    'REDIS_PORT',
    'VAULT_ADDR',
    'CORS_ORIGIN',
    'CORS_CREDENTIALS',
    'ADMIN_ALLOWED_ORIGINS',
    'HELMET_CSP_ENABLED',
    'HELMET_HSTS_ENABLED',
    'UPLOAD_MAX_SIZE',
    'UPLOAD_DIRECTORY',
    'UPLOAD_QUARANTINE_DIR',
    'ALLOWED_FILE_TYPES',
    'LOG_LEVEL',
    'LOG_FORMAT',
    'VITE_PROXY_SECURE'
];
const REQUIRED_SECRETS = [
    'JWT_SECRET',
    'SESSION_SECRET',
    'CSRF_SECRET',
    'POSTGRES_PASSWORD',
    'ENCRYPTION_KEY',
    'PLUGIN_SIGNATURE_SECRET',
    'INTERNAL_GATEWAY_TOKEN',
    'FINGERPRINT_SECRET',
];
function resolveEnvironment() {
    if (process.env.NODE_ENV === 'production') {
        return 'production';
    }
    return 'development';
}
function parseBooleanEnv(value, defaultValue) {
    if (value === undefined) {
        return defaultValue;
    }
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
        return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
        return false;
    }
    return defaultValue;
}
function loadConfig() {
    const env = resolveEnvironment();
    let envConfig;
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
        envConfig = require(`./config.${env}.js`);
    } catch (error) {
        const expectedPath = `./config.${env}.js`;
        throw new Error(
            `Failed to load environment configuration file: ${expectedPath}\n` +
            `Environment: ${env} (from NODE_ENV=${process.env.NODE_ENV || 'undefined'})\n` +
            `Please ensure the file exists or set NODE_ENV to 'development' or 'production'.\n` +
            `Original error: ${error instanceof Error ? error.message : String(error)}`
        );
    }
    const merged = {
        ...envConfig,
        NODE_ENV: process.env.NODE_ENV || envConfig.NODE_ENV || env,
        VERSION: process.env.VERSION || envConfig.VERSION || '1.0.0',
        DEPLOY_ENV: process.env.DEPLOY_ENV || envConfig.DEPLOY_ENV || env,
        SENTRY_DSN: process.env.SENTRY_DSN || envConfig.SENTRY_DSN || '',
        SENTRY_RELEASE: process.env.SENTRY_RELEASE ||
            envConfig.SENTRY_RELEASE ||
            process.env.VERSION ||
            envConfig.VERSION ||
            '1.0.0',
        E2E_TESTING: parseBooleanEnv(process.env.E2E_TESTING, envConfig.E2E_TESTING ?? false),
    };
    validateConfig(merged);
    return Object.freeze(merged);
}
function validateConfig(config) {
    const missing = REQUIRED_KEYS.filter((key) => config[key] === undefined || config[key] === null);
    if (missing.length > 0) {
        throw new Error(`Missing required configuration values: ${missing.join(', ')}`);
    }
}
function getSecret(key, required = true) {
    const value = process.env[key];
    if (!value && required && process.env.NODE_ENV !== 'test') {
        throw new Error(`Missing required secret: ${key}`);
    }
    return value;
}
function validateSecrets() {
    if (process.env.NODE_ENV === 'test') {
        return;
    }
    const missing = REQUIRED_SECRETS.filter((secretKey) => !getSecret(secretKey, false));
    if (missing.length > 0) {
        throw new Error(`Missing required secrets: ${missing.join(', ')}`);
    }
}
exports.getSecret = getSecret;
const loadedConfig = loadConfig();
validateSecrets();
exports.config = Object.freeze({
    ...loadedConfig,
    getSecret,
});
exports.default = exports.config;
//# sourceMappingURL=index.js.map