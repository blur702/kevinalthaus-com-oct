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
    a: ['href', 'title', 'target'],
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
      sanitized[sanitizedKey] = value.map((item: unknown) =>
        typeof item === 'string' ? stripAllHTML(item) : item
      );
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      sanitized[sanitizedKey] = value;
    }
  }

  return sanitized;
}
