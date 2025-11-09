# Page Builder Widgets

This directory contains the extensible plugin-in-plugin widget system for the Page Builder.

## Widget Development Guide

Each widget is a self-contained plugin with its own component, configuration, types, and styles.

### Widget Structure

```
widgets/
  <widget-name>/
    component.tsx     # React component implementation
    config.ts         # Joi validation schema
    types.ts          # TypeScript interfaces
    styles.module.css # Widget-specific styles (optional)
    README.md         # Widget documentation
```

### Creating a New Widget

1. **Create Widget Folder**
   ```bash
   mkdir widgets/my-widget
   ```

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
   export interface MyWidgetConfig {
     title: string;
     alignment: 'left' | 'center' | 'right';
   }
   ```

5. **Register Widget**
   Add to the widget registry in the main application to make it available in the editor palette.

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

### Testing

Each widget should include:
- Unit tests for configuration validation
- Component tests for rendering
- Accessibility tests (ARIA, keyboard nav)
- Visual regression tests

### Performance

- Use React.memo for expensive components
- Lazy load widget bundles
- Optimize images and media
- Limit DOM complexity

### Examples

See individual widget folders for complete implementation examples once they are created.

## Development

To add a widget to the editor:
1. Implement the widget following the structure above
2. Export the component, config, and types
3. Register in the widget palette configuration
4. Test in the editor environment
5. Document usage in the widget's README

## License

MIT
