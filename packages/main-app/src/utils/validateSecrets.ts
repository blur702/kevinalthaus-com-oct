/**
 * Secret Validation Utility
 * Validates environment secrets at application startup
 * Prevents deployment with placeholder or insecure values
 */

import { config } from '@monorepo/shared';

const PLACEHOLDER_PATTERNS = [
  /REPLACE_WITH/i,
  /YOUR_.*_HERE/i,
  /CHANGE_ME/i,
  /CHANGEME/i,
  /PLACEHOLDER/i,
  /TODO/i,
  /FIXME/i,
];

const REQUIRED_SECRETS = [
  'JWT_SECRET',
  'SESSION_SECRET',
  'CSRF_SECRET',
  'INTERNAL_GATEWAY_TOKEN',
  'ENCRYPTION_KEY',
  'PLUGIN_SIGNATURE_SECRET',
  'FINGERPRINT_SECRET',
];

const MIN_SECRET_LENGTH = 32;

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates all required environment secrets
 * @returns Validation result with errors and warnings
 */
export function validateSecrets(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Only validate in production
  if (config.NODE_ENV === 'development' || config.NODE_ENV === 'test') {
    return { isValid: true, errors, warnings };
  }

  for (const secretName of REQUIRED_SECRETS) {
    const secretValue = process.env[secretName];

    // Check if secret exists
    if (!secretValue) {
      errors.push(`${secretName} is not set in environment`);
      continue;
    }

    // Check for placeholder patterns
    const hasPlaceholder = PLACEHOLDER_PATTERNS.some(pattern => pattern.test(secretValue));
    if (hasPlaceholder) {
      errors.push(`${secretName} contains a placeholder value. Run: ./scripts/ensure-jwt-secret.sh`);
      continue;
    }

    // Check minimum length
    if (secretValue.length < MIN_SECRET_LENGTH) {
      warnings.push(`${secretName} is only ${secretValue.length} characters (recommended: ${MIN_SECRET_LENGTH}+)`);
    }
  }

  // Check Sentry DSNs (optional but should not be placeholders)
  if (process.env.SENTRY_DSN && /YOUR_SENTRY_DSN_HERE/i.test(process.env.SENTRY_DSN)) {
    warnings.push('SENTRY_DSN is set to a placeholder value');
  }

  if (process.env.VITE_SENTRY_DSN && /YOUR_SENTRY_DSN_HERE/i.test(process.env.VITE_SENTRY_DSN)) {
    warnings.push('VITE_SENTRY_DSN is set to a placeholder value');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates secrets and throws an error if validation fails
 * Should be called at application startup
 */
export function validateSecretsOrThrow(): void {
  const result = validateSecrets();

  if (result.warnings.length > 0) {
    console.warn('\n⚠️  SECRET VALIDATION WARNINGS:');
    result.warnings.forEach(warning => console.warn(`   - ${warning}`));
    console.warn('');
  }

  if (!result.isValid) {
    console.error('\n❌ SECRET VALIDATION FAILED:');
    result.errors.forEach(error => console.error(`   - ${error}`));
    console.error('\nTo generate secure secrets, run: ./scripts/ensure-jwt-secret.sh\n');
    throw new Error('Environment validation failed: insecure or placeholder secrets detected');
  }

  if (result.errors.length === 0 && result.warnings.length === 0) {
    console.log('✅ All environment secrets validated successfully');
  }
}
