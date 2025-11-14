/**
 * Data normalization utilities to prevent runtime errors from malformed backend responses
 */

/**
 * Logs a warning when data normalization occurs, useful for debugging backend issues.
 *
 * @param feature - The feature or component name
 * @param field - The field that was normalized
 * @param actual - The actual value received
 * @param expected - The expected type
 */
export function logNormalizationWarning(
  feature: string,
  field: string,
  actual: unknown,
  expected: string
): void {
  console.warn(
    `[Data Normalization] ${feature}: Expected ${field} to be ${expected}, got ${typeof actual === 'object' ? JSON.stringify(actual) : actual}. Using fallback.`
  );
}

/**
 * Ensures the value is an array. Returns the value if it's already an array,
 * otherwise returns an empty array.
 *
 * @param value - The value to normalize
 * @param context - Optional context for logging (feature and field name)
 * @returns A valid array
 */
export function asArray<T>(value: unknown, context?: { feature: string; field: string }): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (context) {
    logNormalizationWarning(context.feature, context.field, value, 'array');
  }

  return [];
}

/**
 * Ensures the value is a finite number. Returns the value if it's a valid finite number,
 * otherwise returns the fallback value.
 *
 * @param value - The value to normalize
 * @param fallback - The fallback value to use if the value is not a valid number (default: 0)
 * @param context - Optional context for logging (feature and field name)
 * @returns A finite number
 */
export function asNumber(value: unknown, fallback: number = 0, context?: { feature: string; field: string }): number {
  const num = typeof value === 'number' ? value : Number(value);

  if (Number.isFinite(num)) {
    return num;
  }

  if (context) {
    logNormalizationWarning(context.feature, context.field, value, 'finite number');
  }

  return fallback;
}

/**
 * Ensures the value is a string. Returns the value if it's a string,
 * otherwise returns the fallback value.
 *
 * @param value - The value to normalize
 * @param fallback - The fallback value to use if the value is not a string (default: '')
 * @returns A string
 */
export function asString(value: unknown, fallback: string = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/**
 * Ensures the value is a boolean. Returns the value if it's a boolean,
 * otherwise returns the fallback value.
 *
 * @param value - The value to normalize
 * @param fallback - The fallback value to use if the value is not a boolean (default: false)
 * @returns A boolean
 */
export function asBoolean(value: unknown, fallback: boolean = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Ensures the value is an object (but not null or an array).
 * Returns the value if it's a plain object, otherwise returns an empty object.
 *
 * @param value - The value to normalize
 * @returns A plain object
 */
export function asObject<T extends Record<string, unknown>>(value: unknown): T {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) ? value as T : {} as T;
}
