# Custom WYSIWYG Editor

A plugin-based, extensible rich text editor built on contenteditable with React and TypeScript.

## Features

- **Plugin Architecture**: Extensible system for adding custom functionality
- **TypeScript First**: Full type safety and IntelliSense support
- **Keyboard Shortcuts**: Built-in support for common shortcuts (Ctrl+B, Ctrl+I, etc.)
- **Customizable Toolbar**: Dynamic toolbar generated from loaded plugins
- **Lightweight**: No heavy dependencies, built on native browser APIs
- **Accessible**: ARIA labels and keyboard navigation support

## Installation

The editor is located in `packages/admin/src/components/editor/` and can be imported directly:

```typescript
import { Editor, BoldPlugin, ItalicPlugin, Heading1Plugin } from '@/components/editor';
```

## Quick Start

### Basic Usage

```typescript
import React, { useState } from 'react';
import { Editor, BoldPlugin, ItalicPlugin } from '@/components/editor';

function MyComponent() {
  const [content, setContent] = useState('<p>Hello world!</p>');

  return (
    <Editor
      value={content}
      onChange={setContent}
      plugins={[BoldPlugin, ItalicPlugin]}
      placeholder="Start typing..."
    />
  );
}
```

### With All Built-in Plugins

```typescript
import {
  Editor,
  BoldPlugin,
  ItalicPlugin,
  Heading1Plugin,
  Heading2Plugin,
  Heading3Plugin,
  LinkPlugin,
  ImagePlugin,
} from '@/components/editor';

function RichTextEditor() {
  const [content, setContent] = useState('');

  return (
    <Editor
      value={content}
      onChange={setContent}
      plugins={[
        BoldPlugin,
        ItalicPlugin,
        Heading1Plugin,
        Heading2Plugin,
        Heading3Plugin,
        LinkPlugin,
        ImagePlugin,
      ]}
      minHeight="400px"
      autoFocus
    />
  );
}
```

## Built-in Plugins

### Formatting Plugins

- **BoldPlugin**: Bold formatting (Ctrl+B)
- **ItalicPlugin**: Italic formatting (Ctrl+I)
- **Heading1Plugin**: Heading 1 format
- **Heading2Plugin**: Heading 2 format
- **Heading3Plugin**: Heading 3 format

### Insert Plugins

- **LinkPlugin**: Insert hyperlinks (Ctrl+K)
- **ImagePlugin**: Insert images from URL

## API Reference

### Editor Props

```typescript
interface EditorProps {
  /** Initial/controlled content */
  value?: string;

  /** Content change callback */
  onChange?: (content: string) => void;

  /** Plugins to load */
  plugins?: EditorPlugin[];

  /** Placeholder text */
  placeholder?: string;

  /** Custom CSS class */
  className?: string;

  /** Disable editing */
  readOnly?: boolean;

  /** Auto focus on mount */
  autoFocus?: boolean;

  /** Minimum height */
  minHeight?: string | number;

  /** Maximum height */
  maxHeight?: string | number;
}
```

### EditorCore API

When using a ref, you can access the editor's API:

```typescript
import { useRef } from 'react';
import { Editor, EditorCoreInterface } from '@/components/editor';

function MyComponent() {
  const editorRef = useRef<EditorCoreInterface>(null);

  const handleInsert = () => {
    editorRef.current?.insertHTML('<strong>Bold text</strong>');
  };

  return (
    <>
      <button onClick={handleInsert}>Insert Bold Text</button>
      <Editor ref={editorRef} plugins={[]} />
    </>
  );
}
```

Available methods:

- `getElement()`: Get the contenteditable element
- `getContent()`: Get current HTML content
- `setContent(html)`: Set HTML content
- `executeCommand(command, value)`: Execute a command
- `getSelection()`: Get current selection
- `setSelection(range)`: Set selection/cursor position
- `insertHTML(html)`: Insert HTML at cursor
- `insertText(text)`: Insert text at cursor
- `queryCommandState(command)`: Check if command is active
- `registerPlugin(plugin)`: Register a plugin
- `unregisterPlugin(pluginName)`: Unregister a plugin
- `getPlugins()`: Get all registered plugins
- `focus()`: Focus the editor
- `blur()`: Blur the editor

## Utilities

The editor provides utility functions for working with selections, commands, and HTML:

### Selection Utilities

```typescript
import {
  getCurrentSelection,
  saveSelection,
  restoreSelection,
  hasSelection,
  setCursorAtEnd,
  surroundSelectionWithTag,
} from '@/components/editor';

// Save and restore selection
const savedRange = saveSelection();
// ... do something ...
restoreSelection(savedRange);

// Check if there's a selection
if (hasSelection()) {
  // ...
}

// Move cursor to end
const editor = document.getElementById('editor');
setCursorAtEnd(editor);
```

### Command Utilities

```typescript
import {
  toggleBold,
  toggleItalic,
  formatAsHeading,
  insertLink,
  isBoldActive,
} from '@/components/editor';

// Toggle bold
toggleBold();

// Check if bold is active
if (isBoldActive()) {
  console.log('Selection is bold');
}

// Format as heading
formatAsHeading(2); // H2
```

### HTML Utilities

```typescript
import {
  sanitizeHTML,
  stripHTML,
  cleanPastedHTML,
  isHTMLEmpty,
} from '@/components/editor';

// Sanitize HTML (remove dangerous tags/attributes)
const clean = sanitizeHTML(userInput);

// Strip all HTML tags
const plainText = stripHTML(htmlContent);

// Clean pasted content (remove Word formatting, etc.)
const cleaned = cleanPastedHTML(pastedContent);

// Check if HTML is empty
if (isHTMLEmpty(content)) {
  console.log('No content');
}
```

## Creating Custom Plugins

See [PLUGIN_DEVELOPMENT.md](./PLUGIN_DEVELOPMENT.md) for a comprehensive guide on creating custom plugins.

### Simple Example

```typescript
import React from 'react';
import type { EditorPlugin } from '@/components/editor';

export const MyPlugin: EditorPlugin = {
  name: 'my-plugin',

  toolbar: {
    icon: <>📝</>,
    label: 'My Plugin',
    title: 'Do something cool',
    command: 'myCommand',
    group: 'formatting',
  },

  onCommand(command: string): boolean {
    if (command === 'myCommand') {
      // Do something
      return true; // Handled
    }
    return false;
  },

  isActive(editor): boolean {
    // Check if plugin is active
    return false;
  },
};
```

## Styling

The editor comes with default styles in `Editor.css`. You can customize the appearance by:

1. **Overriding CSS classes**:

```css
.editor-container {
  border-color: #your-color;
}

.editor-toolbar-button.active {
  background: #your-color;
}
```

2. **Using className prop**:

```typescript
<Editor className="my-custom-editor" plugins={[]} />
```

## Examples

### Blog Post Editor

```typescript
function BlogPostEditor() {
  const [content, setContent] = useState('');

  return (
    <Editor
      value={content}
      onChange={setContent}
      plugins={[
        BoldPlugin,
        ItalicPlugin,
        Heading1Plugin,
        Heading2Plugin,
        LinkPlugin,
        ImagePlugin,
      ]}
      placeholder="Write your blog post..."
      minHeight="500px"
    />
  );
}
```

### Comment Editor

```typescript
function CommentEditor() {
  const [content, setContent] = useState('');

  const handleSubmit = () => {
    // Save comment
    console.log('Comment:', content);
  };

  return (
    <div>
      <Editor
        value={content}
        onChange={setContent}
        plugins={[BoldPlugin, ItalicPlugin, LinkPlugin]}
        placeholder="Write a comment..."
        minHeight="100px"
        maxHeight="300px"
      />
      <button onClick={handleSubmit}>Submit</button>
    </div>
  );
}
```

### Read-Only Display

```typescript
function ArticleDisplay({ content }: { content: string }) {
  return (
    <Editor
      value={content}
      readOnly
      plugins={[]}
    />
  );
}
```

## Browser Support

The editor works in all modern browsers that support:
- `contenteditable`
- `document.execCommand` (deprecated but still widely supported)
- ES6+

Tested in:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Architecture

```
editor/
├── types.ts              # TypeScript interfaces
├── EditorCore.tsx        # Core contenteditable component
├── EditorToolbar.tsx     # Toolbar component
├── Editor.tsx            # Main component (combines Core + Toolbar)
├── Editor.css            # Styles
├── utils/
│   ├── selection.ts      # Selection/range utilities
│   ├── commands.ts       # Command execution utilities
│   └── sanitize.ts       # HTML sanitization
├── plugins/
│   ├── BoldPlugin.tsx
│   ├── ItalicPlugin.tsx
│   ├── HeadingPlugin.tsx
│   ├── LinkPlugin.tsx
│   └── ImagePlugin.tsx
└── docs/
    ├── README.md         # This file
    └── PLUGIN_DEVELOPMENT.md
```

## FAQ

**Q: Can I use this editor outside the admin package?**
A: Currently it's in the admin package, but you can move it to `packages/shared` to make it available everywhere.

**Q: How do I handle paste events?**
A: The editor automatically cleans pasted content. You can customize this by creating a plugin with an `onPaste` handler.

**Q: Can I integrate with a markdown editor?**
A: Yes! You can create a plugin that converts HTML to markdown and vice versa.

**Q: How do I add a custom button to the toolbar?**
A: Create a plugin with a `toolbar` configuration. See the plugin development guide.

**Q: Is the HTML output safe?**
A: The editor provides sanitization utilities, but you should always sanitize HTML on the server before storing/displaying it.

## License

This editor is part of the kevinalthaus-com project.
