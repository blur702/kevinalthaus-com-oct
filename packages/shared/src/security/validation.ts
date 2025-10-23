import Ajv, { JSONSchemaType, ValidateFunction } from 'ajv';
import validator from 'validator';

const ajv = new Ajv({ allErrors: true, strict: true });

export class ValidationError extends Error {
  constructor(
    message: string,
    public errors?: unknown[]
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function createValidator<T>(schema: JSONSchemaType<T>): ValidateFunction<T> {
  return ajv.compile(schema);
}

export function validateEmail(email: string): boolean {
  return validator.isEmail(email);
}

export function validateURL(url: string, options?: validator.IsURLOptions): boolean {
  return validator.isURL(url, options);
}

export function validateUUID(uuid: string, version?: validator.UUIDVersion): boolean {
  return validator.isUUID(uuid, version);
}

export function validateJSON(json: string): boolean {
  return validator.isJSON(json);
}

export function validateAlphanumeric(str: string, locale?: validator.AlphanumericLocale): boolean {
  return validator.isAlphanumeric(str, locale);
}

export function validateLength(str: string, options: { min?: number; max?: number }): boolean {
  return validator.isLength(str, options);
}

export function validateIPAddress(ip: string, version?: 4 | 6): boolean {
  return validator.isIP(ip, version);
}

export function sanitizeInput(input: string): string {
  return validator.escape(validator.trim(input));
}

export function validatePluginName(name: string): boolean {
  return /^[a-z0-9-]+$/.test(name) && name.length >= 3 && name.length <= 50;
}

export function validatePluginVersion(version: string): boolean {
  // Guard against extremely long inputs to prevent ReDoS-style behavior
  if (typeof version !== 'string' || version.length === 0 || version.length > 256) {
    return false;
  }
  // Simple, safe semver-like pattern without nested quantifiers
  // e.g., 1.2.3, 1.2.3-alpha.1, 1.2.3+build.5, 1.2.3-alpha+build
  const pattern = /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?(?:\+[A-Za-z0-9.-]+)?$/;
  return pattern.test(version);
}
