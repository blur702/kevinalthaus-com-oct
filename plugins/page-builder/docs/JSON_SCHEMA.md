# Page Builder JSON Schema Documentation

This document provides comprehensive documentation of the JSON schema used for storing page layouts in the Page Builder plugin.

## Table of Contents

- [Schema Versioning](#schema-versioning)
- [PageLayout Structure](#pagelayout-structure)
- [GridConfig Details](#gridconfig-details)
- [WidgetInstance Validation](#widgetinstance-validation)
- [Examples](#examples)
- [Validation Rules](#validation-rules)
- [Best Practices](#best-practices)
- [Migration Guide](#migration-guide)

## Schema Versioning

The JSON schema follows semantic versioning to enable safe evolution:

- **Current Version**: `1.0`
- **Version Format**: `{major}.{minor}`
- **Breaking Changes**: Increment major version (e.g., `1.0` → `2.0`)
- **Additions**: Increment minor version (e.g., `1.0` → `1.1`)

### Migration Between Versions

When the schema version changes, migration functions must be provided in `src/types/index.ts`:

```typescript
export function migrateLayoutFrom_1_0_to_1_1(oldLayout: any): PageLayout {
  // Migration logic
}
```

## PageLayout Structure

The root structure for all page layouts:

```typescript
interface PageLayout {
  version: '1.0';                    // Required, exact string
  grid: GridConfig;                  // Required, grid configuration
  widgets: WidgetInstance[];         // Required, array of widgets
  metadata?: {                       // Optional metadata
    seo?: {                          // SEO metadata
      title?: string;
      description?: string;
      keywords?: string[];
      ogImage?: string;
    };
    accessibility?: {                // Accessibility metadata
      lang?: string;                 // Language code (e.g., 'en')
      dir?: 'ltr' | 'rtl';          // Text direction
      skipLinks?: boolean;           // Enable skip navigation links
    };
  };
}
```

### Required Fields

- **version**: Must be exactly `"1.0"` (string literal)
- **grid**: Valid GridConfig object
- **widgets**: Array of WidgetInstance objects (can be empty)

### Optional Fields

- **metadata**: Additional page-level metadata for SEO and accessibility

## GridConfig Details

Defines the responsive grid system:

```typescript
interface GridConfig {
  columns: number;                   // 1-24, default: 12
  rows?: number;                     // Optional, auto-calculated if not set
  gap: {
    unit: 'px' | 'rem' | '%';       // Required
    value: number;                   // 0-100
  };
  snapToGrid: boolean;               // Default: true
  breakpoints: Breakpoint[];         // At least 1 required
}
```

### Columns

- **Range**: 1-24
- **Default**: 12
- **Purpose**: Defines the number of grid columns for layout positioning

### Gap

Spacing between grid cells:

- **unit**: Must be one of `'px'`, `'rem'`, or `'%'`
- **value**: Number between 0 and 100
- **Example**: `{ unit: 'px', value: 16 }` (16px gap)

### Breakpoints

Array of responsive breakpoints, ordered by `minWidth`:

```typescript
interface Breakpoint {
  name: 'mobile' | 'tablet' | 'desktop' | 'wide';
  minWidth: number;      // Minimum viewport width in pixels
  maxWidth?: number;     // Optional maximum width
  columns?: number;      // Override columns for this breakpoint (1-24)
}
```

**Default Breakpoints**:
```typescript
[
  { name: 'mobile', minWidth: 0, maxWidth: 767, columns: 4 },
  { name: 'tablet', minWidth: 768, maxWidth: 1023, columns: 8 },
  { name: 'desktop', minWidth: 1024, maxWidth: 1439, columns: 12 },
  { name: 'wide', minWidth: 1440, columns: 16 }
]
```

## WidgetInstance Validation

Each widget in the layout must conform to this structure:

```typescript
interface WidgetInstance {
  id: string;                        // UUID v4, unique
  type: string;                      // Registered widget type
  position: GridPosition;            // Grid placement
  config: WidgetConfig;              // Widget-specific config
  children?: WidgetInstance[];       // Optional nested widgets
  isLocked?: boolean;                // Prevent editing
}
```

### ID Requirements

- **Format**: UUID v4 (e.g., `"550e8400-e29b-41d4-a716-446655440000"`)
- **Uniqueness**: Must be unique across all widgets on the page
- **Generation**: Use `uuid.v4()` or database `gen_random_uuid()`

### Type

- **Format**: String matching a registered widget type
- **Examples**: `'text-content'`, `'image'`, `'video'`, `'button'`
- **Validation**: Must exist in the widget registry

### Position

```typescript
interface GridPosition {
  x: number;                         // 0-based column index
  y: number;                         // 0-based row index
  width: number;                     // Columns to span (min: 1)
  height: number;                    // Rows to span (min: 1)
  responsive?: ResponsivePosition[]; // Breakpoint overrides
  zIndex?: number;                   // Stacking order
}
```

**Constraints**:
- `x >= 0`
- `y >= 0`
- `width >= 1`
- `height >= 1`
- `x + width <= grid.columns` (position must fit in grid)
- No overlaps unless `zIndex` is used

### Responsive Position

Override position for specific breakpoints:

```typescript
interface ResponsivePosition {
  breakpoint: string;                // Matches Breakpoint.name
  x: number;
  y: number;
  width: number;
  height: number;
}
```

**Example**:
```json
{
  "x": 0,
  "y": 0,
  "width": 12,
  "height": 1,
  "responsive": [
    {
      "breakpoint": "mobile",
      "x": 0,
      "y": 0,
      "width": 4,
      "height": 2
    }
  ]
}
```

### Config

Widget-specific configuration object:

```typescript
interface WidgetConfig {
  [key: string]: any;
}
```

**Rules**:
- Must be a plain object (not null, array, or primitive)
- Must be JSON-serializable (no functions, circular references)
- Should be validated by widget-specific Joi schema
- Keys should be prefixed by widget type for clarity (optional but recommended)

**Example** (text-content widget):
```json
{
  "content": "<p>Hello <strong>world</strong>!</p>",
  "alignment": "center",
  "fontSize": 16,
  "fontFamily": "Arial, sans-serif"
}
```

### Children

For container widgets (accordion, tabs, carousel):

- **Type**: Array of WidgetInstance
- **Max Depth**: 5 levels to prevent performance issues
- **Validation**: Recursive validation of child widgets

## Examples

### Simple Page

A basic page with a single text widget:

```json
{
  "version": "1.0",
  "grid": {
    "columns": 12,
    "gap": {
      "unit": "px",
      "value": 16
    },
    "snapToGrid": true,
    "breakpoints": [
      { "name": "mobile", "minWidth": 0, "columns": 4 },
      { "name": "tablet", "minWidth": 768, "columns": 8 },
      { "name": "desktop", "minWidth": 1024, "columns": 12 }
    ]
  },
  "widgets": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "text-content",
      "position": {
        "x": 0,
        "y": 0,
        "width": 12,
        "height": 1
      },
      "config": {
        "content": "Hello World",
        "alignment": "center"
      }
    }
  ]
}
```

### Complex Page

Page with multiple widgets, responsive layout, and nested children:

```json
{
  "version": "1.0",
  "grid": {
    "columns": 12,
    "gap": { "unit": "px", "value": 24 },
    "snapToGrid": true,
    "breakpoints": [
      { "name": "mobile", "minWidth": 0, "maxWidth": 767, "columns": 4 },
      { "name": "tablet", "minWidth": 768, "maxWidth": 1023, "columns": 8 },
      { "name": "desktop", "minWidth": 1024, "columns": 12 }
    ]
  },
  "widgets": [
    {
      "id": "header-001",
      "type": "heading",
      "position": {
        "x": 0,
        "y": 0,
        "width": 12,
        "height": 1,
        "responsive": [
          { "breakpoint": "mobile", "x": 0, "y": 0, "width": 4, "height": 1 }
        ]
      },
      "config": {
        "level": 1,
        "text": "Welcome to My Site",
        "alignment": "center"
      }
    },
    {
      "id": "image-001",
      "type": "image",
      "position": {
        "x": 0,
        "y": 1,
        "width": 6,
        "height": 2,
        "responsive": [
          { "breakpoint": "mobile", "x": 0, "y": 1, "width": 4, "height": 2 }
        ]
      },
      "config": {
        "src": "https://example.com/image.jpg",
        "alt": "Hero image",
        "caption": "Beautiful landscape"
      }
    },
    {
      "id": "text-001",
      "type": "text-content",
      "position": {
        "x": 6,
        "y": 1,
        "width": 6,
        "height": 2,
        "responsive": [
          { "breakpoint": "mobile", "x": 0, "y": 3, "width": 4, "height": 2 }
        ]
      },
      "config": {
        "content": "<p>This is a rich text paragraph with <strong>bold</strong> and <em>italic</em> text.</p>"
      }
    },
    {
      "id": "accordion-001",
      "type": "accordion",
      "position": {
        "x": 0,
        "y": 3,
        "width": 12,
        "height": 1
      },
      "config": {
        "allowMultiple": false
      },
      "children": [
        {
          "id": "accordion-section-001",
          "type": "accordion-section",
          "position": { "x": 0, "y": 0, "width": 1, "height": 1 },
          "config": {
            "title": "Section 1",
            "content": "Content for section 1"
          }
        },
        {
          "id": "accordion-section-002",
          "type": "accordion-section",
          "position": { "x": 0, "y": 1, "width": 1, "height": 1 },
          "config": {
            "title": "Section 2",
            "content": "Content for section 2"
          }
        }
      ]
    }
  ],
  "metadata": {
    "seo": {
      "title": "Welcome - My Site",
      "description": "A beautiful page built with Page Builder",
      "keywords": ["page builder", "cms", "web design"]
    },
    "accessibility": {
      "lang": "en",
      "dir": "ltr",
      "skipLinks": true
    }
  }
}
```

## Validation Rules

### Layout-Level Rules

1. **Version Match**: `version` must exactly match `"1.0"`
2. **Widget ID Uniqueness**: All widget IDs must be unique across the entire layout (including nested children)
3. **Max Widgets**: Maximum 100 widgets per page (including children)
4. **No Circular References**: Children cannot reference parent widgets

### Widget-Level Rules

1. **Position Within Grid**: `x + width <= grid.columns`
2. **Positive Dimensions**: `width >= 1`, `height >= 1`
3. **Non-Negative Coordinates**: `x >= 0`, `y >= 0`
4. **Valid Breakpoints**: Responsive position breakpoints must match defined grid breakpoints
5. **Max Nesting Depth**: Children depth limited to 5 levels

### Config Rules

1. **JSON Serializable**: No functions, undefined, or circular references
2. **Type Validation**: Validate against widget-specific Joi schema
3. **Size Limit**: Config object should be < 100KB when serialized

## Best Practices

### 1. Use Semantic Widget Types

Choose descriptive widget type names:
- ✅ `text-content`, `image-gallery`, `call-to-action`
- ❌ `widget1`, `comp`, `thing`

### 2. Document Custom Config Keys

Add comments in widget type definitions:
```typescript
interface TextContentConfig {
  content: string;        // HTML content (sanitized)
  alignment: 'left' | 'center' | 'right';  // Text alignment
  fontSize?: number;      // Font size in pixels (optional)
}
```

### 3. Validate Serialization Round-Trip

Always test that your layout can be:
1. Serialized to JSON string
2. Parsed back to object
3. Validated against schema
4. Used to render the page

```typescript
const layout: PageLayout = createMyLayout();
const json = JSON.stringify(layout);
const parsed = JSON.parse(json);
const validated = validatePageLayout(parsed);
// validated should deep-equal layout
```

### 4. Prefix Config Keys by Type

For clarity in debugging:
```json
{
  "type": "text-content",
  "config": {
    "textContent:content": "...",
    "textContent:alignment": "center"
  }
}
```

### 5. Limit Nested Depth

Keep widget nesting shallow for performance:
- ✅ 1-2 levels (header → button)
- ⚠️ 3-4 levels (accordion → section → text)
- ❌ 5+ levels (causes rendering issues)

### 6. Use Responsive Positions Sparingly

Only override positions when necessary:
- Mobile-first: Define default as mobile, override for desktop
- Test all breakpoints to ensure no layout breaks

## Migration Guide

### Adding a New Field (Minor Version)

When adding optional fields to existing types:

1. Increment minor version: `1.0` → `1.1`
2. Make field optional with default value
3. Provide backward compatibility

Example:
```typescript
// Version 1.1 adds optional "theme" field
interface PageLayout {
  version: '1.0' | '1.1';
  grid: GridConfig;
  widgets: WidgetInstance[];
  metadata?: {
    seo?: Record<string, any>;
    accessibility?: Record<string, any>;
    theme?: string;  // NEW in 1.1
  };
}
```

### Breaking Changes (Major Version)

When changing required fields or removing fields:

1. Increment major version: `1.0` → `2.0`
2. Provide migration function
3. Update validation schema

Example:
```typescript
export function migrateLayoutFrom_1_to_2(oldLayout: any): PageLayout {
  return {
    version: '2.0',
    grid: migrateGridConfig(oldLayout.grid),
    widgets: oldLayout.widgets.map(migrateWidget),
    // Handle breaking changes
  };
}
```

## Tools

### Validation in APIs

Use Joi schemas from `src/types/index.ts`:

```typescript
import { validatePageLayout } from '@monorepo/page-builder/types';

try {
  const validLayout = validatePageLayout(req.body.layout);
  // Use validLayout
} catch (error) {
  res.status(400).json({ error: error.message });
}
```

### TypeScript Type Guards

```typescript
function isValidWidgetInstance(obj: any): obj is WidgetInstance {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.type === 'string' &&
    obj.position !== undefined &&
    obj.config !== undefined
  );
}
```

## References

- [Joi Documentation](https://joi.dev/api/)
- [JSON Schema](https://json-schema.org/)
- [UUID v4 Specification](https://tools.ietf.org/html/rfc4122)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
