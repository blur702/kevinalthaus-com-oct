/**
 * Central configuration loader.
 *
 * Non-secret, environment-specific defaults live in the config/*.js files.
 * Secrets (passwords, API keys, tokens) must stay in .env files and are accessed
 * through the getSecret helper so that they are never written to source control.
 */

import type { AppConfig } from '../packages/shared/src/types/appConfig';
export type { AppConfig } from '../packages/shared/src/types/appConfig';

type EnvironmentName = 'development' | 'production';


type RuntimeConfig = AppConfig & {
  getSecret: typeof getSecret;
};

const REQUIRED_KEYS: (keyof AppConfig)[] = [
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
] as const;

function resolveEnvironment(): EnvironmentName {
  if (process.env.NODE_ENV === 'production') {
    return 'production';
  }
  return 'development';
}

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
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

function loadConfig(): AppConfig {
  const env = resolveEnvironment();
  let envConfig: Partial<AppConfig>;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    envConfig = require(`./config.${env}.js`) as Partial<AppConfig>;
  } catch (error) {
    const expectedPath = `./config.${env}.js`;
    const e = error as NodeJS.ErrnoException | Error;

    // Check if this is specifically a missing config file (not a syntax/runtime error)
    const isMissingModule = e && 'code' in e && e.code === 'MODULE_NOT_FOUND' &&
      e.message && e.message.includes(expectedPath);

    if (isMissingModule) {
      // Missing config file - provide helpful guidance
      throw new Error(
        `Configuration file not found: ${expectedPath}\n` +
        `Environment: ${env} (from NODE_ENV=${process.env.NODE_ENV || 'undefined'})\n` +
        `Please ensure the file exists or set NODE_ENV to 'development' or 'production'.`
      );
    }

    // Syntax error, runtime error, or other failure in the config file
    throw new Error(
      `Failed to load environment configuration file: ${expectedPath}\n` +
      `Environment: ${env} (from NODE_ENV=${process.env.NODE_ENV || 'undefined'})\n` +
      `This may be due to a syntax error or runtime error in the config file.\n` +
      `Original error: ${e.message || String(error)}\n` +
      (e.stack ? `Stack: ${e.stack}` : '')
    );
  }

  const merged: Partial<AppConfig> = {
    ...envConfig,
    NODE_ENV: process.env.NODE_ENV || envConfig.NODE_ENV || env,
    VERSION: process.env.VERSION || envConfig.VERSION || '1.0.0',
    DEPLOY_ENV: process.env.DEPLOY_ENV || envConfig.DEPLOY_ENV || env,
    SENTRY_DSN: process.env.SENTRY_DSN || envConfig.SENTRY_DSN || '',
    SENTRY_RELEASE:
      process.env.SENTRY_RELEASE ||
      envConfig.SENTRY_RELEASE ||
      process.env.VERSION ||
      envConfig.VERSION ||
      '1.0.0',
    E2E_TESTING: parseBooleanEnv(process.env.E2E_TESTING, envConfig.E2E_TESTING ?? false),
  };

  validateConfig(merged);
  return Object.freeze(merged) as AppConfig;
}

function validateConfig(config: Partial<AppConfig>): asserts config is AppConfig {
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

let secretsValidated = false;

function validateSecrets(): void {
  if (secretsValidated || process.env.NODE_ENV === 'test') {
    return;
  }

  const missing = REQUIRED_SECRETS.filter((secretKey) => !process.env[secretKey]);

  if (missing.length > 0) {
    throw new Error(`Missing required secrets: ${missing.join(', ')}`);
  }

  secretsValidated = true;
}

export function getSecret(key: string, required = true): string | undefined {
  // Validate all required secrets on first call to getSecret
  validateSecrets();

  const value = process.env[key];
  if (!value && required && process.env.NODE_ENV !== 'test') {
    throw new Error(`Missing required secret: ${key}`);
  }
  return value;
}

const loadedConfig = loadConfig();

// Eager validation of critical secrets at startup (except in test environment)
if (process.env.NODE_ENV !== 'test') {
  const CRITICAL_SECRETS = ['JWT_SECRET', 'SESSION_SECRET', 'CSRF_SECRET'] as const;
  const missingCritical = CRITICAL_SECRETS.filter((secretKey) => !process.env[secretKey]);

  if (missingCritical.length > 0) {
    throw new Error(
      `Application startup failed: Missing critical secrets: ${missingCritical.join(', ')}\n` +
      `These secrets must be set in your .env file before the application can start.\n` +
      `See .env.example for guidance on generating secure values.`
    );
  }
}

export const config: RuntimeConfig = Object.freeze({
  ...loadedConfig,
  getSecret,
});

export default config;

