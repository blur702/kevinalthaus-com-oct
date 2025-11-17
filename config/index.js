"use strict";
/**
 * Central configuration loader.
 *
 * Non-secret, environment-specific defaults live in the config/*.js files.
 * Secrets (passwords, API keys, tokens) must stay in .env files and are accessed
 * through the getSecret helper so that they are never written to source control.
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.getSecret = void 0;
var REQUIRED_KEYS = [
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
var REQUIRED_SECRETS = [
    'JWT_SECRET',
    'SESSION_SECRET',
    'CSRF_SECRET',
    // POSTGRES_PASSWORD removed - validated in db/index.ts which supports POSTGRES_PASSWORD_FILE
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
    var normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
        return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
        return false;
    }
    return defaultValue;
}
function loadConfig() {
    var _a;
    var env = resolveEnvironment();
    var envConfig;
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
        envConfig = require("./config.".concat(env, ".js"));
    }
    catch (error) {
        var expectedPath = "./config.".concat(env, ".js");
        var e = error;
        // Check if this is specifically a missing config file (not a syntax/runtime error)
        var isMissingModule = e && 'code' in e && e.code === 'MODULE_NOT_FOUND' &&
            e.message && e.message.includes(expectedPath);
        if (isMissingModule) {
            // Missing config file - provide helpful guidance
            throw new Error("Configuration file not found: ".concat(expectedPath, "\n") +
                "Environment: ".concat(env, " (from NODE_ENV=").concat(process.env.NODE_ENV || 'undefined', ")\n") +
                "Please ensure the file exists or set NODE_ENV to 'development' or 'production'.");
        }
        // Syntax error, runtime error, or other failure in the config file
        throw new Error("Failed to load environment configuration file: ".concat(expectedPath, "\n") +
            "Environment: ".concat(env, " (from NODE_ENV=").concat(process.env.NODE_ENV || 'undefined', ")\n") +
            "This may be due to a syntax error or runtime error in the config file.\n" +
            "Original error: ".concat(e.message || String(error), "\n") +
            (e.stack ? "Stack: ".concat(e.stack) : ''));
    }
    var merged = __assign(__assign({}, envConfig), { NODE_ENV: process.env.NODE_ENV || envConfig.NODE_ENV || env, VERSION: process.env.VERSION || envConfig.VERSION || '1.0.0', DEPLOY_ENV: process.env.DEPLOY_ENV || envConfig.DEPLOY_ENV || env, SENTRY_DSN: process.env.SENTRY_DSN || envConfig.SENTRY_DSN || '', SENTRY_RELEASE: process.env.SENTRY_RELEASE ||
            envConfig.SENTRY_RELEASE ||
            process.env.VERSION ||
            envConfig.VERSION ||
            '1.0.0', E2E_TESTING: parseBooleanEnv(process.env.E2E_TESTING, (_a = envConfig.E2E_TESTING) !== null && _a !== void 0 ? _a : false) });
    validateConfig(merged);
    return Object.freeze(merged);
}
function validateConfig(config) {
    var missing = REQUIRED_KEYS.filter(function (key) {
        var value = config[key];
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
        throw new Error("Missing required configuration values: ".concat(missing.join(', ')));
    }
}
var secretsValidated = false;
function validateSecrets() {
    if (secretsValidated || process.env.NODE_ENV === 'test') {
        return;
    }
    var missing = REQUIRED_SECRETS.filter(function (secretKey) { return !process.env[secretKey]; });
    if (missing.length > 0) {
        throw new Error("Missing required secrets: ".concat(missing.join(', ')));
    }
    secretsValidated = true;
}
function getSecret(key, required) {
    if (required === void 0) { required = true; }
    // Validate all required secrets on first call to getSecret
    validateSecrets();
    var value = process.env[key];
    if (!value && required && process.env.NODE_ENV !== 'test') {
        throw new Error("Missing required secret: ".concat(key));
    }
    return value;
}
exports.getSecret = getSecret;
var loadedConfig = loadConfig();
// Eager validation of critical secrets at startup (except in test environment)
if (process.env.NODE_ENV !== 'test') {
    var CRITICAL_SECRETS = ['JWT_SECRET', 'SESSION_SECRET', 'CSRF_SECRET'];
    var missingCritical = CRITICAL_SECRETS.filter(function (secretKey) { return !process.env[secretKey]; });
    if (missingCritical.length > 0) {
        throw new Error("Application startup failed: Missing critical secrets: ".concat(missingCritical.join(', '), "\n") +
            "These secrets must be set in your .env file before the application can start.\n" +
            "See .env.example for guidance on generating secure values.");
    }
}
exports.config = Object.freeze(__assign(__assign({}, loadedConfig), { getSecret: getSecret }));
exports.default = exports.config;
