# Page Builder Widgets

This directory contains the extensible plugin-in-plugin widget system for the Page Builder.

## Auto-Discovery System

Widgets are automatically discovered and registered at plugin activation. The system scans this `widgets/` directory for widget folders and validates their structure.

### How Discovery Works

1. **Plugin Activation**: When the Page Builder plugin activates, the Widget Registry Service scans the `widgets/` directory
2. **Structure Validation**: Each widget folder is checked for required files (`widget.json`, `component.tsx`, `config.ts`, `types.ts`)
3. **Manifest Validation**: The `widget.json` file is parsed and validated against the widget manifest schema
4. **Registry Storage**: Valid widgets are stored in an in-memory registry with their metadata and file paths
5. **API Exposure**: The registry is exposed via REST API endpoints (`/api/page-builder/widgets`)
6. **Frontend Access**: The frontend queries available widgets to populate the drag-and-drop editor palette

### Discovery Results

- **Valid Widgets**: Pass all validation checks and are available in the editor
- **Invalid Widgets**: Have validation errors but are stored in the registry with `isValid: false` status
- **Missing Files**: Widgets missing required files are skipped and logged as warnings

The discovery process never fails plugin activation - it continues with whatever valid widgets are found.

## Widget Development Guide

Each widget is a self-contained module with its own component, configuration, types, and manifest.

### Widget Structure

```
widgets/
  <widget-name>/
    widget.json       # Widget manifest (REQUIRED)
    component.tsx     # React component implementation (REQUIRED)
    config.ts         # Joi validation schema (REQUIRED)
    types.ts          # TypeScript interfaces (REQUIRED)
    styles.module.css # Widget-specific styles (optional)
    README.md         # Widget documentation (recommended)
```

### Widget Manifest (widget.json)

Every widget must include a `widget.json` manifest file with metadata about the widget. This file is read at plugin activation to register the widget.

**Required Fields:**
- `type` (string): Unique widget identifier in kebab-case (e.g., `"text-content"`)
- `name` (string): Short display name (e.g., `"Text Content"`)
- `displayName` (string): Human-readable name (e.g., `"Rich Text Content"`)
- `description` (string): Widget description (1-500 characters)
- `category` (string): Widget category - see [Widget Categories](#widget-categories) below
- `icon` (string): Icon identifier (Material-UI icon name or custom path)
- `version` (string): Semantic version (e.g., `"1.0.0"`)
- `author` (object): Author information with `name` and `email`
- `configSchema` (string): Must be `"config.ts"`
- `tags` (array): Search tags for widget discovery
- `isContainer` (boolean): Whether widget can contain children (like accordion/tabs)
- `deprecated` (boolean): Whether widget is deprecated

**Optional Fields:**
- `previewImage` (string): Path to thumbnail image

**Example:**
```json
{
  "type": "text-content",
  "name": "Text Content",
  "displayName": "Rich Text Content",
  "description": "Editable text content with rich formatting options",
  "category": "general",
  "icon": "text_fields",
  "version": "1.0.0",
  "author": {
    "name": "Kevin Althaus",
    "email": "contact@kevinalthaus.com"
  },
  "configSchema": "config.ts",
  "previewImage": null,
  "tags": ["text", "content", "wysiwyg"],
  "isContainer": false,
  "deprecated": false
}
```

See `widget-template/widget.json` for a complete reference.

### Widget Categories

Widgets are organized into standard categories for the editor palette:

- **general**: Basic content widgets (text, image, heading, etc.)
- **creative**: Design-focused widgets (gallery, carousel, etc.)
- **marketing**: Conversion-focused widgets (CTA buttons, forms, testimonials)
- **header-footer**: Site structure widgets (navigation, footer, etc.)
- **social-media**: Social integration widgets (share buttons, feeds, etc.)
- **forms**: Form and input widgets
- **advanced**: Complex or specialized widgets

Choose the category that best fits your widget's primary purpose.

### Creating a New Widget

**Step 0: Copy the Widget Template**
```bash
cp -r widgets/widget-template widgets/my-widget
cd widgets/my-widget
```

The `widget-template` folder provides a complete reference implementation with all required files and documentation. Using it as a starting point ensures you follow best practices.

1. **Update Widget Manifest** (widget.json)
   - Change `type` to your unique widget identifier
   - Update `name`, `displayName`, and `description`
   - Set appropriate `category` from the list above
   - Choose an `icon` (Material-UI icon or custom)
   - Update `author` information
   - Add relevant `tags`

2. **Implement Component** (component.tsx)
   ```tsx
   import React from 'react';
   import { WidgetInstance } from '../../src/types';

   interface MyWidgetProps {
     widget: WidgetInstance;
     isEditing: boolean;
     onChange?: (config: any) => void;
   }

   export const MyWidget: React.FC<MyWidgetProps> = ({ widget, isEditing, onChange }) => {
     const { config } = widget;

     return (
       <div className="my-widget">
         {/* Widget implementation */}
       </div>
     );
   };
   ```

3. **Define Configuration Schema** (config.ts)
   ```typescript
   import Joi from 'joi';

   export const myWidgetConfigSchema = Joi.object({
     // Define your widget's configuration options
     title: Joi.string().required(),
     alignment: Joi.string().valid('left', 'center', 'right').default('left'),
   });

   export const myWidgetDefaults = {
     title: 'My Widget',
     alignment: 'left',
   };
   ```

4. **Define Types** (types.ts)
   ```typescript
   import { WidgetConfig } from '../../src/types';

   export interface MyWidgetConfig extends WidgetConfig {
     title: string;
     alignment: 'left' | 'center' | 'right';
   }
   ```

5. **Test Widget Discovery**
   - Restart the plugin or server to trigger widget discovery
   - Check server logs for discovery results
   - Query the widget registry API:
     ```bash
     curl http://localhost:3000/api/page-builder/widgets
     ```
   - Verify your widget appears with `isValid: true`

No manual registration is needed - widgets are automatically discovered and registered at plugin activation!

### Built-in Widget Types (Planned)

- **text-content**: Rich text editor with WYSIWYG
- **image**: Image with caption, alt text, and responsive sizing
- **video**: Video embed with autoplay/controls options
- **button**: Call-to-action button with link and styling
- **heading**: Semantic headings (H1-H6) with styling
- **divider**: Horizontal rule with customization
- **spacer**: Vertical spacing control
- **accordion**: Collapsible content sections
- **tabs**: Tabbed content container
- **carousel**: Image/content slideshow
- **form**: Form builder with validation
- **map**: Embedded map with markers
- **code**: Syntax-highlighted code blocks
- **custom-html**: Advanced custom HTML/CSS/JS (sandboxed)

### Shared Components

Use shared components from the content manager and WYSIWYG editor:
- **RichTextEditor**: For text content editing
- **MediaPicker**: For image/video selection
- **ColorPicker**: For color configuration
- **IconPicker**: For icon selection

### Accessibility Requirements

All widgets MUST implement WCAG AA compliance:

1. **Keyboard Navigation**
   - All interactive elements must be keyboard accessible
   - Logical tab order
   - Visible focus indicators

2. **ARIA Attributes**
   - Proper roles (e.g., `role="region"`, `role="button"`)
   - Labels for screen readers
   - States and properties (e.g., `aria-expanded`, `aria-hidden`)

3. **Semantic HTML**
   - Use appropriate HTML5 elements
   - Heading hierarchy
   - Landmark regions

4. **Color Contrast**
   - Minimum 4.5:1 ratio for normal text
   - Minimum 3:1 ratio for large text and UI components

5. **Alt Text**
   - Images must have meaningful alt attributes
   - Decorative images should use `alt=""`

### Validation

All widget configurations are validated using Joi schemas:
- Required fields must be specified
- Types must match TypeScript interfaces
- Constraints (min/max, patterns) should prevent invalid states

### Testing Widgets

#### Testing Widget Discovery

To verify your widget is discovered correctly:

1. **Check Server Logs**: Look for discovery messages when the plugin activates
   ```
   [PageBuilder] Starting widget discovery
   [PageBuilder] Successfully loaded widget 'my-widget'
   [PageBuilder] Widget discovery complete: 5 valid, 0 invalid
   ```

2. **Query Registry Endpoint**: Use the API to see all registered widgets
   ```bash
   # Get all widgets
   curl http://localhost:3000/api/page-builder/widgets

   # Get specific widget
   curl http://localhost:3000/api/page-builder/widgets/my-widget

   # Filter by category
   curl http://localhost:3000/api/page-builder/widgets?category=general
   ```

3. **Check Validation Status**: Ensure your widget has `isValid: true` in the response

#### Testing Widget Functionality

Each widget should include:
- Unit tests for configuration validation
- Component tests for rendering in edit and preview modes
- Accessibility tests (ARIA, keyboard nav)
- Visual regression tests

### Performance

- Use React.memo for expensive components
- Lazy load widget bundles
- Optimize images and media
- Limit DOM complexity

### Troubleshooting

#### Widget Not Appearing in Registry

**Problem**: Widget doesn't show up when querying `/api/page-builder/widgets`

**Solutions**:
- Verify all required files exist: `widget.json`, `component.tsx`, `config.ts`, `types.ts`
- Check `widget.json` syntax is valid JSON (use a JSON validator)
- Review server logs for specific validation errors
- Ensure widget folder name follows kebab-case convention
- Restart the server to trigger re-discovery

#### Widget Marked as Invalid

**Problem**: Widget appears in registry but has `isValid: false`

**Solutions**:
- Check server logs for detailed validation errors
- Ensure `widget.json` contains all required fields
- Verify `type` field uses kebab-case format (lowercase with hyphens)
- Confirm `category` is one of the valid categories
- Check `version` follows semantic versioning (e.g., "1.0.0")
- Validate `author.email` is a valid email address

#### Component Not Loading

**Problem**: Widget renders but shows errors or blank content

**Solutions**:
- Verify `component.tsx` exports a default function component
- Check for TypeScript compilation errors in the component
- Ensure all imports use correct relative paths
- Review browser console for runtime errors
- Test the component in isolation first

#### Schema Validation Failures

**Problem**: Widget configs fail validation unexpectedly

**Solutions**:
- Ensure `config.ts` exports a valid Joi schema as default or named export
- Verify schema field names match the TypeScript interface in `types.ts`
- Check for typos in field names or validation rules
- Test the schema with sample data independently
- Review conditional validation logic (`.when()` clauses)

### Examples

See the `widget-template/` folder for a complete reference implementation with:
- All required files properly structured
- Comprehensive inline documentation
- Example configuration options
- Dual-mode rendering (edit vs preview)
- Accessibility best practices

Additional widget examples will be added as the library grows.

## Development

To add a widget to the editor:
1. Copy the `widget-template` folder as a starting point
2. Update `widget.json` with your widget's metadata
3. Implement the component, config, and types
4. Test widget discovery via server logs and API
5. Test the widget in the page builder editor
6. Document usage in the widget's README

## License

MIT
