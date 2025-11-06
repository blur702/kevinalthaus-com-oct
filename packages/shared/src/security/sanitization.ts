import sanitizeHtml, { IOptions } from 'sanitize-html';

const DEFAULT_SANITIZE_OPTIONS: IOptions = {
  allowedTags: [
    'b',
    'i',
    'em',
    'strong',
    'a',
    'p',
    'br',
    'ul',
    'ol',
    'li',
    'code',
    'pre',
    'blockquote',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    code: ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    a: ['http', 'https', 'mailto'],
  },
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
      // Enforce rel tokens when target is present, merging with existing rel
      if (attribs.target) {
        const existing = (attribs.rel || '').split(/\s+/).filter(Boolean);
        const required = ['noopener', 'noreferrer'];
        const merged = Array.from(new Set([...existing, ...required])).join(' ');
        return {
          tagName,
          attribs: {
            ...attribs,
            rel: merged,
          },
        };
      }
      return {
        tagName,
        attribs,
      };
    },
  },
};

const STRICT_SANITIZE_OPTIONS: IOptions = {
  allowedTags: [],
  allowedAttributes: {},
};

export function sanitizeHTML(dirty: string, options: IOptions = DEFAULT_SANITIZE_OPTIONS): string {
  return sanitizeHtml(dirty, options);
}

export function stripAllHTML(dirty: string): string {
  return sanitizeHtml(dirty, STRICT_SANITIZE_OPTIONS);
}

export function sanitizePluginDescription(description: string): string {
  return sanitizeHtml(description, {
    allowedTags: ['b', 'i', 'em', 'strong', 'code'],
    allowedAttributes: {},
  });
}

export function sanitizeFilename(filename: string): string {
  // Separate name and extension
  const lastDotIndex = filename.lastIndexOf('.');
  const name = lastDotIndex !== -1 ? filename.substring(0, lastDotIndex) : filename;
  const ext = lastDotIndex !== -1 ? filename.substring(lastDotIndex) : '';

  // Make URL-friendly:
  // 1. Convert to lowercase for consistency
  // 2. Replace spaces with hyphens
  // 3. Remove special characters (keep only alphanumeric, hyphens, underscores)
  // 4. Replace multiple consecutive separators with single hyphen
  // 5. Remove leading/trailing separators
  const sanitizedName = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9_-]/g, '') // Remove special characters
    .replace(/[-_]{2,}/g, '-') // Replace multiple separators with single hyphen
    .replace(/^[-_]+|[-_]+$/g, ''); // Remove leading/trailing separators

  // Sanitize extension (preserve dots, lowercase)
  const sanitizedExt = ext
    .toLowerCase()
    .replace(/\.{2,}/g, '.'); // Replace multiple dots with single dot

  // Ensure the extension is preserved by calculating max name length
  const maxNameLength = 255 - sanitizedExt.length;

  // If extension is too long or name would be <=0, fall back
  if (maxNameLength <= 0) {
    // Extension itself is too long, truncate it and use fallback name
    const truncatedExt = sanitizedExt.substring(0, 254); // Save 1 char for name
    return 'f' + truncatedExt; // Minimal name + truncated extension
  }

  // Truncate name to fit within limit while preserving full extension
  const truncatedName = sanitizedName.substring(0, maxNameLength);

  // If name is empty after sanitization and truncation, use fallback
  const finalName = truncatedName || 'file';

  // Combine name and extension (guaranteed <=255 chars)
  return finalName + sanitizedExt;
}

export function sanitizePathComponent(component: string): string {
  return component
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/^\.+/, '')
    .substring(0, 100);
}

export function sanitizeDatabaseIdentifier(identifier: string): string {
  return identifier
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^[0-9]/, '_$&')
    .substring(0, 63);
}

export class ConfigKeyCollisionError extends Error {
  constructor(
    message: string,
    public readonly originalKey: string,
    public readonly conflictingKey: string
  ) {
    super(message);
    this.name = 'ConfigKeyCollisionError';
  }
}

// Maximum recursion depth to prevent stack overflow
const MAX_RECURSION_DEPTH = 50;

/**
 * Helper to recursively sanitize array elements.
 * Handles nested arrays and objects without introducing temp keys.
 * @param arr - Array to sanitize
 * @param depth - Current recursion depth (default 0)
 * @returns Sanitized array
 * @throws Error if max recursion depth is exceeded (fail-closed security behavior)
 */
function sanitizeArray(arr: unknown[], depth: number = 0): unknown[] {
  // Fail-closed: throw error instead of returning unsanitized data
  if (depth >= MAX_RECURSION_DEPTH) {
    throw new Error('Max recursion depth exceeded in sanitizeArray');
  }

  return arr.map((item: unknown) => {
    if (typeof item === 'string') {
      return stripAllHTML(item);
    } else if (Array.isArray(item)) {
      return sanitizeArray(item, depth + 1);
    } else if (typeof item === 'object' && item !== null) {
      return sanitizePluginConfig(item as Record<string, unknown>, depth + 1);
    }
    return item;
  });
}

export function sanitizePluginConfig(config: Record<string, unknown>, depth: number = 0): Record<string, unknown> {
  // Fail-closed: throw error instead of returning unsanitized data
  if (depth >= MAX_RECURSION_DEPTH) {
    throw new Error('Max recursion depth exceeded while sanitizing plugin config');
  }
  const sanitized: Record<string, unknown> = {};
  const keyMapping = new Map<string, string>();

  for (const [key, value] of Object.entries(config)) {
    const sanitizedKey = sanitizeDatabaseIdentifier(key);

    // Check for key collision using Map to properly detect all collisions
    // (checking sanitized[key] !== undefined fails when first value is undefined)
    if (keyMapping.has(sanitizedKey)) {
      const originalKey = keyMapping.get(sanitizedKey)!;
      throw new ConfigKeyCollisionError(
        `Configuration key collision: "${key}" and "${originalKey}" both normalize to "${sanitizedKey}"`,
        originalKey,
        key
      );
    }

    keyMapping.set(sanitizedKey, key);

    if (typeof value === 'string') {
      sanitized[sanitizedKey] = stripAllHTML(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[sanitizedKey] = sanitizePluginConfig(value as Record<string, unknown>, depth + 1);
    } else if (Array.isArray(value)) {
      sanitized[sanitizedKey] = sanitizeArray(value, depth + 1);
    } else {
      sanitized[sanitizedKey] = value;
    }
  }

  return sanitized;
}
