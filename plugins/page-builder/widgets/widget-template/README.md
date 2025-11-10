# Widget Template

This is a reference template for creating new page builder widgets. Use this as a starting point when developing custom widgets for the page builder system.

## Overview

This template demonstrates the complete structure and implementation patterns required for page builder widgets. It includes all necessary files, proper TypeScript typing, validation schemas, and component architecture.

## Quick Start

Follow these steps to create a new widget based on this template:

1. **Copy this folder** and rename it to your widget name (use kebab-case):
   ```bash
   cp -r widget-template my-custom-widget
   cd my-custom-widget
   ```

2. **Update `widget.json`** with your widget's metadata:
   - Change `type` to your widget's unique identifier (e.g., `"my-custom-widget"`)
   - Update `name`, `displayName`, and `description`
   - Set appropriate `category` (general, creative, marketing, etc.)
   - Choose an `icon` (Material-UI icon name or custom path)
   - Update `author` information
   - Add relevant `tags` for searchability

3. **Implement `component.tsx`** with your widget's UI:
   - Define your component's interface extending the base props
   - Implement edit mode controls (inputs, selects, toggles, etc.)
   - Implement preview mode rendering (clean, semantic HTML)
   - Add proper TypeScript typing and ARIA attributes

4. **Define `config.ts`** with your validation schema:
   - Create a Joi schema validating all configuration fields
   - Add appropriate validation rules (required, min/max, patterns, etc.)
   - Define default values for all configuration options
   - Use conditional validation for dependent fields

5. **Update `types.ts`** with your TypeScript interfaces:
   - Define your config interface extending `WidgetConfig`
   - Ensure types align with your Joi schema
   - Add any additional helper types or enums

6. **Test your widget** in the page builder:
   - Restart the plugin or server to trigger widget discovery
   - Check server logs for successful widget registration
   - Query `/api/page-builder/widgets` to verify registration
   - Add your widget to a page and test in edit and preview modes

## File Structure

### Required Files

All widgets must include these four files:

#### `widget.json` (Manifest)
- **Purpose**: Widget metadata and registration information
- **Format**: JSON file read at plugin activation
- **Contents**: Type, name, category, icon, version, author, etc.
- **Validation**: Must pass `widgetManifestSchema` validation

#### `component.tsx` (React Component)
- **Purpose**: Widget rendering and editing interface
- **Format**: TypeScript React component
- **Props**: `widget`, `editMode`, `onChange`
- **Pattern**: Dual-mode rendering (edit vs preview)

#### `config.ts` (Validation Schema)
- **Purpose**: Joi schema for configuration validation
- **Format**: TypeScript file exporting Joi schema
- **Exports**: Schema object and default values
- **Usage**: Backend validation and frontend form generation

#### `types.ts` (Type Definitions)
- **Purpose**: TypeScript interfaces for type safety
- **Format**: TypeScript declarations
- **Contents**: Config interface and helper types
- **Alignment**: Must match Joi schema structure

### Optional Files

These files enhance your widget but aren't required:

- **`styles.module.css`**: CSS modules for component styling
- **`README.md`**: Widget documentation (recommended)
- **`utils.ts`**: Helper functions and utilities
- **`constants.ts`**: Widget-specific constants

## Configuration Schema

The `config.ts` file defines how your widget's configuration is validated and what default values are used.

### Common Validation Patterns

```typescript
// Required string field
fieldName: Joi.string().required()

// Optional string with min/max length
description: Joi.string().min(1).max(500).optional()

// Number with range
fontSize: Joi.number().min(8).max(72).default(16)

// Enum/select field
alignment: Joi.string().valid('left', 'center', 'right').default('left')

// Boolean toggle
enabled: Joi.boolean().default(true)

// URL validation
imageUrl: Joi.string().uri().optional()

// Email validation
email: Joi.string().email().required()

// Hex color pattern
color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#000000')

// Conditional validation (field required when another field is true)
borderColor: Joi.string()
  .pattern(/^#[0-9A-Fa-f]{6}$/)
  .when('showBorder', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional()
  })

// Array of strings
tags: Joi.array().items(Joi.string()).min(0).max(10).default([])

// Nested object
style: Joi.object({
  color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).required(),
  fontSize: Joi.number().min(8).max(72).required()
}).required()
```

## Component API

### Props Interface

```typescript
interface WidgetProps {
  widget: WidgetInstance;    // Widget instance from page layout
  editMode: boolean;         // Whether in edit or preview mode
  onChange?: (config: WidgetConfig) => void;  // Callback to update config
}
```

### Dual-Mode Rendering Pattern

Widgets must implement two rendering modes:

**Edit Mode**: Render configuration controls
- Input fields, selects, checkboxes, color pickers, etc.
- Call `onChange` when configuration values change
- Show labels and helper text for user guidance
- Include ARIA labels for accessibility

**Preview/Render Mode**: Render clean output
- Semantic HTML without editor controls
- Apply configured styles and content
- No interactive controls (read-only)
- Proper ARIA attributes for screen readers

### Example Structure

```typescript
export default function MyWidget({ widget, editMode, onChange }: WidgetProps) {
  const config = widget.config as MyWidgetConfig;

  const handleConfigChange = (updates: Partial<MyWidgetConfig>) => {
    if (onChange) {
      onChange({ ...config, ...updates });
    }
  };

  if (editMode) {
    return (
      <div className="my-widget-editor">
        {/* Configuration controls */}
      </div>
    );
  }

  return (
    <div className="my-widget">
      {/* Rendered output */}
    </div>
  );
}
```

## Best Practices

### Widget Design
- **Single Purpose**: Keep widgets focused on one specific function
- **Composable**: Design widgets to work well together
- **Reusable**: Make widgets configurable and flexible
- **Performant**: Avoid heavy computations or large dependencies

### Configuration
- **JSON-Serializable**: All config values must be JSON-serializable
  - No functions, no circular references
  - Use strings, numbers, booleans, arrays, and plain objects
- **Sensible Defaults**: Provide good default values for all fields
- **Validation**: Validate all inputs thoroughly with Joi schemas
- **Documentation**: Add JSDoc comments explaining each field

### Component Implementation
- **Type Safety**: Use proper TypeScript typing throughout
- **Accessibility**: Implement WCAG AA compliance
  - Add ARIA labels and roles
  - Ensure keyboard navigation works
  - Use semantic HTML elements
- **Error Handling**: Handle missing or invalid configs gracefully
- **Performance**: Use React best practices (memoization, etc.)

### Accessibility Requirements

All widgets must meet WCAG AA compliance:

- **Semantic HTML**: Use appropriate HTML elements (`<article>`, `<section>`, `<nav>`, etc.)
- **ARIA Attributes**: Add `role`, `aria-label`, `aria-describedby` where needed
- **Keyboard Navigation**: All interactive elements must be keyboard accessible
- **Color Contrast**: Ensure sufficient color contrast ratios (4.5:1 for normal text)
- **Focus Indicators**: Visible focus indicators for all interactive elements
- **Alt Text**: Provide alternative text for images and media

### Testing

Before deploying your widget:

1. **Discovery Test**: Verify widget appears in registry
   ```bash
   curl http://localhost:3000/api/page-builder/widgets
   ```

2. **Schema Validation**: Test with various config values
   - Valid configurations should pass
   - Invalid configurations should fail with clear errors

3. **Edit Mode**: Test all configuration controls
   - All inputs should update config correctly
   - Conditional fields should show/hide properly
   - Validation should prevent invalid values

4. **Preview Mode**: Test rendered output
   - Content should render correctly
   - Styles should apply as configured
   - No editor controls should appear

5. **Accessibility**: Test with screen readers and keyboard only
   - All content should be accessible
   - Navigation should work without mouse
   - ARIA labels should be descriptive

6. **Edge Cases**: Test with:
   - Missing optional fields
   - Empty strings
   - Maximum length values
   - Unusual configurations

## Troubleshooting

### Widget Not Appearing

**Problem**: Widget doesn't show up in the registry

**Solutions**:
- Check all required files exist: `widget.json`, `component.tsx`, `config.ts`, `types.ts`
- Validate `widget.json` syntax (use a JSON validator)
- Check server logs for validation errors
- Ensure widget folder name matches your naming convention
- Restart the server to trigger re-discovery

### Validation Errors

**Problem**: Widget marked as invalid in registry

**Solutions**:
- Check server logs for specific validation errors
- Ensure `widget.json` matches `widgetManifestSchema`
- Verify all required fields are present
- Check field types and value constraints
- Ensure `type` uses kebab-case format

### Component Not Loading

**Problem**: Widget renders but shows error or blank

**Solutions**:
- Verify `component.tsx` exports a default component
- Check for TypeScript compilation errors
- Ensure all imports are correct (relative paths)
- Test component in isolation first
- Check browser console for errors

### Schema Errors

**Problem**: Config validation fails unexpectedly

**Solutions**:
- Ensure `config.ts` exports valid Joi schema
- Check schema matches the type definitions in `types.ts`
- Test schema independently with sample data
- Verify conditional validation logic
- Check for typos in field names

## Examples

Once additional widgets are implemented, you can reference them here:

- `text-content` - Simple text/heading widget
- `image` - Image display with alt text and caption
- `button` - Call-to-action button
- `spacer` - Vertical spacing control
- `divider` - Horizontal rule/separator

## Additional Resources

- [Page Builder Plugin Documentation](../README.md)
- [Widget Registry API](../../src/services/widget-registry.service.ts)
- [Type Definitions](../../src/types/index.ts)
- [Joi Documentation](https://joi.dev/api/)
- [React TypeScript](https://react-typescript-cheatsheet.netlify.app/)
- [WCAG AA Guidelines](https://www.w3.org/WAI/WCAG2AA-Conformance)

## Support

If you encounter issues or have questions:

1. Check the troubleshooting section above
2. Review the main widgets README at `../README.md`
3. Examine the widget registry service code
4. Check server logs for detailed error messages
5. Test the template widget to ensure system is working
