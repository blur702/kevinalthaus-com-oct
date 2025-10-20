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
};

const STRICT_SANITIZE_OPTIONS: IOptions = {
  allowedTags: [],
  allowedAttributes: {},
};

export function sanitizeHTML(
  dirty: string,
  options: IOptions = DEFAULT_SANITIZE_OPTIONS
): string {
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

export function sanitizePluginConfig(config: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    const sanitizedKey = sanitizeDatabaseIdentifier(key);

    if (typeof value === 'string') {
      sanitized[sanitizedKey] = stripAllHTML(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[sanitizedKey] = sanitizePluginConfig(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      sanitized[sanitizedKey] = value.map((item) =>
        typeof item === 'string' ? stripAllHTML(item) : item
      );
    } else {
      sanitized[sanitizedKey] = value;
    }
  }

  return sanitized;
}
