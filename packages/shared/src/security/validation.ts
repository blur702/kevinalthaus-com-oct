import Ajv, { JSONSchemaType, ValidateFunction } from 'ajv';
import validator from 'validator';
import semver from 'semver';

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
  // Use battle-tested semver library to avoid ReDoS issues
  if (typeof version !== 'string') {
    return false;
  }
  return semver.valid(version) !== null;
}
