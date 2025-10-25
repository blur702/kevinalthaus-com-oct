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
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .substring(0, 255);
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

/**
 * Helper to recursively sanitize array elements.
 * Handles nested arrays and objects without introducing temp keys.
 */
function sanitizeArray(arr: unknown[]): unknown[] {
  return arr.map((item: unknown) => {
    if (typeof item === 'string') {
      return stripAllHTML(item);
    } else if (Array.isArray(item)) {
      return sanitizeArray(item);
    } else if (typeof item === 'object' && item !== null) {
      return sanitizePluginConfig(item as Record<string, unknown>);
    }
    return item;
  });
}

export function sanitizePluginConfig(config: Record<string, unknown>): Record<string, unknown> {
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
      sanitized[sanitizedKey] = sanitizePluginConfig(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      sanitized[sanitizedKey] = sanitizeArray(value);
    } else {
      sanitized[sanitizedKey] = value;
    }
  }

  return sanitized;
}
