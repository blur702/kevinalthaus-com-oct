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
function resolveEnvironment() {
    if (process.env.NODE_ENV === 'production') {
        return 'production';
    }
    return 'development';
}
function loadConfig() {
    const env = resolveEnvironment();
    let envConfig;
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
        envConfig = require(`./config.${env}.js`);
    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
            const expectedPath = `config/config.${env}.js`;
            throw new Error(
                `Configuration file not found: ${expectedPath}\n` +
                `Environment resolved as: "${env}" (from NODE_ENV="${process.env.NODE_ENV || 'undefined'}")\n` +
                `Expected file: ${expectedPath}\n` +
                `Available environments: development, production\n` +
                `Suggestion: Set NODE_ENV to a valid environment or create the missing config file.`
            );
        }
        // Re-throw other errors (syntax errors, etc.)
        throw error;
    }
    const merged = {
        ...envConfig,
        NODE_ENV: process.env.NODE_ENV || envConfig.NODE_ENV || env,
        VERSION: process.env.VERSION || envConfig.VERSION || '1.0.0',
        DEPLOY_ENV: process.env.DEPLOY_ENV || envConfig.DEPLOY_ENV || env,
        SENTRY_RELEASE: process.env.SENTRY_RELEASE ||
            envConfig.SENTRY_RELEASE ||
            process.env.VERSION ||
            envConfig.VERSION ||
            '1.0.0',
    };
    validateConfig(merged);
    return Object.freeze(merged);
}
function validateConfig(config) {
    const missing = REQUIRED_KEYS.filter((key) => {
        const value = config[key];
        // Treat undefined, null as missing
        if (value === undefined || value === null) {
            return true;
        }
        // Also treat empty or whitespace-only strings as missing
        if (typeof value === 'string' && value.trim() === '') {
            return true;
        }
        return false;
    });
    if (missing.length > 0) {
        throw new Error(`Missing required configuration values: ${missing.join(', ')}`);
    }
}
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

const CRITICAL_SECRETS = ['JWT_SECRET', 'SESSION_SECRET', 'CSRF_SECRET'];

let secretsValidated = false;

function validateSecrets() {
    // Return early if already validated or in test environment
    if (secretsValidated || process.env.NODE_ENV === 'test') {
        return;
    }

    // Check existence directly on process.env without calling getSecret
    const missing = REQUIRED_SECRETS.filter((secretKey) => !process.env[secretKey]);

    if (missing.length > 0) {
        throw new Error(`Missing required secrets: ${missing.join(', ')}`);
    }

    secretsValidated = true;
}

function validateCriticalSecrets() {
    // Skip validation in test environment
    if (process.env.NODE_ENV === 'test') {
        return;
    }

    const missingCritical = CRITICAL_SECRETS.filter((secretKey) => !process.env[secretKey]);

    if (missingCritical.length > 0) {
        throw new Error(
            `Application startup failed: Missing critical secrets: ${missingCritical.join(', ')}\n` +
            `These secrets must be set in your .env file before the application can start.\n` +
            `See .env.example for guidance on generating secure values.`
        );
    }
}

function getSecret(key, required = true) {
    // Validate all secrets on first use
    validateSecrets();

    const value = process.env[key];
    if (!value && required) {
        // Fail fast regardless of NODE_ENV when required is true
        throw new Error(`Missing required secret: ${key}`);
    }

    // Optionally emit warning when required is false and value is missing
    if (!value && !required && process.env.NODE_ENV === 'test') {
        if (typeof console !== 'undefined' && console.warn) {
            console.warn(`[CONFIG WARNING] Optional secret not set: ${key}`);
        }
    }

    return value;
}
exports.getSecret = getSecret;

const loadedConfig = loadConfig();

// Eager validation of critical secrets at startup (except in test environment)
validateCriticalSecrets();

exports.config = Object.freeze({
    ...loadedConfig,
    getSecret,
});
exports.default = exports.config;
//# sourceMappingURL=index.js.map