# Page Builder Security Guide

This document outlines security considerations, best practices, and implementation guidelines for the Page Builder plugin.

## Table of Contents

- [Input Sanitization](#input-sanitization)
- [Content Security Policy (CSP)](#content-security-policy-csp)
- [Authentication & Authorization](#authentication--authorization)
- [SQL Injection Prevention](#sql-injection-prevention)
- [XSS Protection](#xss-protection)
- [CSRF Protection](#csrf-protection)
- [File Upload Security](#file-upload-security)
- [Rate Limiting](#rate-limiting)
- [Audit Logging](#audit-logging)
- [Security Checklist](#security-checklist)

## Input Sanitization

All user input must be sanitized before storage and rendering.

### HTML Content Sanitization

Use `sanitize-html` library for rich text content:

```typescript
import sanitizeHtml from 'sanitize-html';

const sanitizeConfig = {
  allowedTags: [
    'p', 'br', 'strong', 'em', 'u', 's', 'sub', 'sup',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
    'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
  ],
  allowedAttributes: {
    'a': ['href', 'title', 'target', 'rel'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    'table': ['class'],
    'th': ['scope', 'colspan', 'rowspan'],
    'td': ['colspan', 'rowspan']
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    img: ['http', 'https', 'data']
  },
  transformTags: {
    'a': (tagName, attribs) => {
      // Force external links to open in new tab with security
      if (attribs.href && !attribs.href.startsWith('/')) {
        return {
          tagName,
          attribs: {
            ...attribs,
            target: '_blank',
            rel: 'noopener noreferrer'
          }
        };
      }
      return { tagName, attribs };
    }
  }
};

export function sanitizeContent(html: string): string {
  return sanitizeHtml(html, sanitizeConfig);
}
```

### URL Validation

Validate URLs to prevent javascript: and data: schemes:

```typescript
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function sanitizeUrl(url: string): string | null {
  if (!isValidUrl(url)) {
    return null;
  }
  return url;
}
```

### JSON Sanitization

Prevent prototype pollution and circular references:

```typescript
export function sanitizeJson(obj: any): any {
  // Remove prototype pollution attempts
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  const cleaned: any = Array.isArray(obj) ? [] : {};

  for (const key of Object.keys(obj)) {
    // Block dangerous keys
    if (['__proto__', 'constructor', 'prototype'].includes(key)) {
      continue;
    }

    cleaned[key] = sanitizeJson(obj[key]);
  }

  return cleaned;
}
```

## Content Security Policy (CSP)

Implement strict CSP headers for the page builder editor and rendered pages.

### Editor CSP

```typescript
app.use('/admin/page-builder', (req, res, next) => {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Editor needs eval for Monaco
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));
  next();
});
```

### Rendered Pages CSP

```typescript
app.use('/pages/:slug', (req, res, next) => {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'", // No inline scripts
    "style-src 'self' 'unsafe-inline'", // Allow inline styles for widget styling
    "img-src 'self' https: data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src 'self' https://www.youtube.com https://player.vimeo.com", // Video embeds
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));
  next();
});
```

### Custom Code Widget Sandboxing

For widgets that allow custom HTML/CSS/JS, use sandboxed iframes:

```html
<iframe
  sandbox="allow-scripts allow-same-origin"
  srcdoc="<html>...</html>"
  style="border: none; width: 100%; height: 100%;"
></iframe>
```

**Sandbox Attributes**:
- `allow-scripts`: Enable JavaScript (isolated context)
- `allow-same-origin`: Enable DOM access (use cautiously)
- Omit `allow-forms`, `allow-top-navigation` for security

## Authentication & Authorization

### Capability-Based Access Control

All API endpoints check user capabilities:

```typescript
import { requireCapabilities } from '@monorepo/shared/middleware';

router.post('/pages',
  authenticate,
  requireCapabilities(['database:write']),
  async (req, res) => {
    // Create page
  }
);

router.get('/pages/:id',
  authenticate,
  requireCapabilities(['database:read']),
  async (req, res) => {
    // Get page
  }
);
```

### Row-Level Security

Check ownership for non-public resources:

```typescript
export async function canUserEditPage(
  userId: string,
  pageId: string,
  pool: Pool
): Promise<boolean> {
  const result = await pool.query(
    `SELECT created_by FROM plugin_page_builder.pages
     WHERE id = $1 AND deleted_at IS NULL`,
    [pageId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  const page = result.rows[0];

  // Check if user is creator or has admin capability
  return page.created_by === userId || await isAdmin(userId);
}
```

### Template/Block Visibility

Respect `is_public` flag for templates:

```sql
SELECT * FROM plugin_page_builder.templates
WHERE deleted_at IS NULL
  AND (is_public = TRUE OR created_by = $1)
ORDER BY created_at DESC;
```

## SQL Injection Prevention

Always use parameterized queries:

```typescript
// ✅ SAFE: Parameterized query
const result = await pool.query(
  'SELECT * FROM plugin_page_builder.pages WHERE id = $1',
  [pageId]
);

// ❌ UNSAFE: String concatenation
const result = await pool.query(
  `SELECT * FROM plugin_page_builder.pages WHERE id = '${pageId}'`
);
```

### Dynamic Column Names

Whitelist allowed columns for sorting/filtering:

```typescript
const ALLOWED_SORT_COLUMNS = ['created_at', 'updated_at', 'title', 'status'];

export function buildSortClause(sortBy: string, order: 'ASC' | 'DESC'): string {
  if (!ALLOWED_SORT_COLUMNS.includes(sortBy)) {
    throw new Error('Invalid sort column');
  }

  if (!['ASC', 'DESC'].includes(order)) {
    throw new Error('Invalid sort order');
  }

  return `ORDER BY ${sortBy} ${order}`;
}
```

## XSS Protection

### React Component Rendering

React escapes content by default, but be cautious with `dangerouslySetInnerHTML`:

```tsx
// ✅ SAFE: React escapes automatically
<p>{widget.config.title}</p>

// ⚠️ RISKY: Must sanitize first
<div dangerouslySetInnerHTML={{
  __html: sanitizeContent(widget.config.content)
}} />

// ❌ UNSAFE: Never use without sanitization
<div dangerouslySetInnerHTML={{ __html: widget.config.content }} />
```

### Server-Side Rendering

Always escape HTML entities:

```typescript
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```

### Widget Config Validation

Validate widget configs against schemas:

```typescript
import { widgetInstanceSchema } from '../types';

export function validateWidget(widget: any): void {
  const { error } = widgetInstanceSchema.validate(widget);
  if (error) {
    throw new Error(`Invalid widget: ${error.message}`);
  }

  // Additional sanitization
  if (widget.config.content) {
    widget.config.content = sanitizeContent(widget.config.content);
  }

  if (widget.config.href) {
    widget.config.href = sanitizeUrl(widget.config.href);
  }
}
```

## CSRF Protection

Use CSRF tokens for all state-changing operations:

```typescript
import csrf from 'csurf';

const csrfProtection = csrf({ cookie: true });

router.post('/pages', csrfProtection, async (req, res) => {
  // Create page
});

router.put('/pages/:id', csrfProtection, async (req, res) => {
  // Update page
});

router.delete('/pages/:id', csrfProtection, async (req, res) => {
  // Delete page
});
```

### Frontend Integration

Include CSRF token in requests:

```typescript
fetch('/api/page-builder/pages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'CSRF-Token': getCsrfToken() // From meta tag or cookie
  },
  body: JSON.stringify(pageData)
});
```

## File Upload Security

If allowing file uploads for thumbnails:

### File Type Validation

```typescript
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
];

export function isAllowedFileType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}
```

### File Size Limits

```typescript
import multer from 'multer';

const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (isAllowedFileType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});
```

### Filename Sanitization

```typescript
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export function sanitizeFilename(originalName: string): string {
  const ext = path.extname(originalName);
  const uuid = uuidv4();
  return `${uuid}${ext}`;
}
```

## Rate Limiting

Prevent abuse with rate limiting:

```typescript
import rateLimit from 'express-rate-limit';

const createPageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per window
  message: 'Too many pages created, please try again later'
});

router.post('/pages', createPageLimiter, async (req, res) => {
  // Create page
});

const updatePageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Max 30 updates per minute
  message: 'Too many updates, please try again later'
});

router.put('/pages/:id', updatePageLimiter, async (req, res) => {
  // Update page
});
```

## Audit Logging

Log all security-relevant actions:

```typescript
export async function logSecurityEvent(
  pool: Pool,
  event: {
    userId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    ipAddress: string;
    userAgent: string;
    success: boolean;
    errorMessage?: string;
  }
): Promise<void> {
  await pool.query(
    `INSERT INTO plugin_page_builder.security_audit_log
     (user_id, action, resource_type, resource_id, ip_address, user_agent, success, error_message, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
    [
      event.userId,
      event.action,
      event.resourceType,
      event.resourceId,
      event.ipAddress,
      event.userAgent,
      event.success,
      event.errorMessage || null
    ]
  );
}
```

### Audit Log Schema

```sql
CREATE TABLE IF NOT EXISTS plugin_page_builder.security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_user_id ON plugin_page_builder.security_audit_log (user_id);
CREATE INDEX idx_audit_log_created_at ON plugin_page_builder.security_audit_log (created_at DESC);
CREATE INDEX idx_audit_log_resource ON plugin_page_builder.security_audit_log (resource_type, resource_id);
```

## Security Checklist

### Pre-Deployment

- [ ] All user input sanitized before storage
- [ ] HTML content sanitized with allowlist
- [ ] URLs validated (no javascript:, data: schemes)
- [ ] JSON validated for prototype pollution
- [ ] Parameterized queries used throughout
- [ ] CSRF protection enabled on all POST/PUT/DELETE
- [ ] Rate limiting configured
- [ ] CSP headers set for editor and pages
- [ ] Authentication middleware on all protected routes
- [ ] Capability checks on all operations
- [ ] Row-level security for user-owned resources
- [ ] Audit logging for sensitive actions
- [ ] Error messages don't leak sensitive info
- [ ] File uploads validated (type, size, content)
- [ ] Custom code widgets sandboxed in iframes

### Code Review

- [ ] No `dangerouslySetInnerHTML` without sanitization
- [ ] No string concatenation in SQL queries
- [ ] No eval() or Function() constructors
- [ ] No disabled CSP or permissive directives
- [ ] No hardcoded secrets or credentials
- [ ] No excessive permissions granted
- [ ] Error handling doesn't expose stack traces

### Monitoring

- [ ] Security audit logs reviewed regularly
- [ ] Failed authentication attempts monitored
- [ ] Rate limit violations tracked
- [ ] Suspicious patterns detected (mass deletion, etc.)
- [ ] Database query performance monitored
- [ ] File upload patterns analyzed

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [sanitize-html Documentation](https://github.com/apostrophecms/sanitize-html)
