# Plugin Development Guide

This guide explains how to create custom plugins for the WYSIWYG editor.

## Plugin Interface

Every plugin must implement the `EditorPlugin` interface:

```typescript
interface EditorPlugin {
  /** Unique plugin name */
  name: string;

  /** Toolbar button configuration (optional) */
  toolbar?: PluginToolbarConfig;

  /** Initialize plugin when editor mounts (optional) */
  onInit?(editor: EditorCore): void;

  /** Handle custom commands (optional) */
  onCommand?(command: string, value?: any): boolean | void;

  /** Handle keyboard shortcuts (optional) */
  onKeyDown?(event: KeyboardEvent, editor: EditorCore): boolean | void;

  /** Handle paste events (optional) */
  onPaste?(event: ClipboardEvent, editor: EditorCore): boolean | void;

  /** Handle input events (optional) */
  onInput?(event: InputEvent, editor: EditorCore): boolean | void;

  /** Check if plugin command is currently active (optional) */
  isActive?(editor: EditorCore): boolean;

  /** Check if plugin command is currently disabled (optional) */
  isDisabled?(editor: EditorCore): boolean;

  /** Cleanup when editor unmounts (optional) */
  onDestroy?(): void;
}
```

## Minimal Plugin

The simplest plugin only needs a name:

```typescript
export const MinimalPlugin: EditorPlugin = {
  name: 'minimal',
};
```

## Adding a Toolbar Button

```typescript
import React from 'react';
import type { EditorPlugin } from '../types';

export const MyPlugin: EditorPlugin = {
  name: 'my-plugin',

  toolbar: {
    icon: <>✨</>,           // React element (SVG, text, etc.)
    label: 'My Plugin',      // Accessibility label
    title: 'Do magic',       // Tooltip
    command: 'doMagic',      // Command to execute
    shortcut: 'Ctrl+M',      // Display shortcut hint
    group: 'formatting',     // Group buttons together
  },

  onCommand(command: string): boolean {
    if (command === 'doMagic') {
      // Execute your logic here
      console.log('Magic happened!');
      return true; // Return true if handled
    }
    return false;
  },
};
```

### Toolbar Configuration

```typescript
interface PluginToolbarConfig {
  icon: ReactNode;          // Button icon (SVG, emoji, text)
  label: string;            // Accessibility label
  title?: string;           // Tooltip text
  shortcut?: string;        // Keyboard shortcut display
  command?: string;         // Command to execute on click
  group?: string;           // Group name for button grouping
}
```

Common groups:
- `formatting`: Bold, Italic, Underline
- `heading`: H1, H2, H3
- `insert`: Link, Image, Table
- `list`: Ordered, Unordered lists
- `align`: Left, Center, Right alignment

## Handling Keyboard Shortcuts

```typescript
export const BoldPlugin: EditorPlugin = {
  name: 'bold',

  toolbar: {
    icon: <strong>B</strong>,
    label: 'Bold',
    title: 'Bold (Ctrl+B)',
    command: 'bold',
    shortcut: 'Ctrl+B',
    group: 'formatting',
  },

  onKeyDown(event: KeyboardEvent, editor: EditorCore): boolean {
    // Handle Ctrl+B or Cmd+B
    if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
      editor.executeCommand('bold');
      return true; // Prevent default behavior
    }
    return false;
  },
};
```

**Important**: Return `true` to mark the event as handled and prevent default behavior. Return `false` to allow other plugins to handle it.

## Active State

Show button as active when the plugin's formatting is applied:

```typescript
export const BoldPlugin: EditorPlugin = {
  name: 'bold',

  // ... toolbar config ...

  isActive(editor: EditorCore): boolean {
    return editor.queryCommandState('bold');
  },
};
```

## Disabled State

Disable button when the plugin cannot be used:

```typescript
import { hasSelection } from '../utils/selection';

export const LinkPlugin: EditorPlugin = {
  name: 'link',

  // ... toolbar config ...

  isDisabled(editor: EditorCore): boolean {
    // Disable if no text is selected
    return !hasSelection();
  },
};
```

## Custom Commands

Plugins can handle custom commands with any logic:

```typescript
export const TablePlugin: EditorPlugin = {
  name: 'table',

  toolbar: {
    icon: <>📊</>,
    label: 'Table',
    title: 'Insert Table',
    command: 'insertTable',
    group: 'insert',
  },

  onCommand(command: string, value?: any): boolean {
    if (command === 'insertTable') {
      const rows = value?.rows || 3;
      const cols = value?.cols || 3;

      // Build table HTML
      let html = '<table><tbody>';
      for (let i = 0; i < rows; i++) {
        html += '<tr>';
        for (let j = 0; j < cols; j++) {
          html += '<td>&nbsp;</td>';
        }
        html += '</tr>';
      }
      html += '</tbody></table>';

      // Insert into editor
      document.execCommand('insertHTML', false, html);
      return true;
    }
    return false;
  },
};
```

## Working with Selection

```typescript
import {
  getCurrentSelection,
  hasSelection,
  saveSelection,
  restoreSelection,
} from '../utils/selection';

export const HighlightPlugin: EditorPlugin = {
  name: 'highlight',

  toolbar: {
    icon: <>🖍️</>,
    label: 'Highlight',
    title: 'Highlight text',
    command: 'highlight',
    group: 'formatting',
  },

  onCommand(command: string): boolean {
    if (command === 'highlight' && hasSelection()) {
      // Save current selection
      const range = saveSelection();

      if (range) {
        // Create highlight span
        const span = document.createElement('span');
        span.style.backgroundColor = 'yellow';
        span.appendChild(range.extractContents());

        // Insert highlighted content
        range.insertNode(span);

        // Restore selection
        restoreSelection(range);
      }

      return true;
    }
    return false;
  },

  isDisabled(): boolean {
    return !hasSelection();
  },
};
```

## Handling Paste Events

```typescript
export const PlainTextPastePlugin: EditorPlugin = {
  name: 'plain-text-paste',

  onPaste(event: ClipboardEvent, editor: EditorCore): boolean {
    // Get plain text from clipboard
    const text = event.clipboardData?.getData('text/plain');

    if (text) {
      // Insert as plain text (no formatting)
      editor.insertText(text);
      return true; // Prevent default paste behavior
    }

    return false;
  },
};
```

## Handling Input Events

```typescript
export const AutoLinkPlugin: EditorPlugin = {
  name: 'auto-link',

  onInput(event: InputEvent, editor: EditorCore): boolean {
    // Get the current line/word
    const text = editor.getContent();

    // Check if user typed a URL
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const match = text.match(urlPattern);

    if (match) {
      // Convert plain URL to link
      const newContent = text.replace(
        urlPattern,
        '<a href="$1" target="_blank">$1</a>'
      );
      editor.setContent(newContent);
      return true;
    }

    return false;
  },
};
```

## Plugin Initialization and Cleanup

```typescript
export const AutoSavePlugin: EditorPlugin = {
  name: 'auto-save',
  private saveInterval: NodeJS.Timeout | null = null;

  onInit(editor: EditorCore): void {
    // Start auto-save timer
    this.saveInterval = setInterval(() => {
      const content = editor.getContent();
      localStorage.setItem('draft', content);
      console.log('Auto-saved!');
    }, 30000); // Every 30 seconds
  },

  onDestroy(): void {
    // Clean up timer
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
  },
};
```

## Using Editor API

The `EditorCore` interface provides these methods:

```typescript
interface EditorCore {
  getElement(): HTMLDivElement | null;
  getContent(): string;
  setContent(html: string): void;
  executeCommand(command: string, value?: any): boolean;
  getSelection(): EditorSelection | null;
  setSelection(range: Range): void;
  insertHTML(html: string): void;
  insertText(text: string): void;
  queryCommandState(command: string): boolean;
  registerPlugin(plugin: EditorPlugin): void;
  unregisterPlugin(pluginName: string): void;
  getPlugins(): EditorPlugin[];
  focus(): void;
  blur(): void;
}
```

Example usage:

```typescript
export const InsertDatePlugin: EditorPlugin = {
  name: 'insert-date',

  toolbar: {
    icon: <>📅</>,
    label: 'Insert Date',
    title: 'Insert current date',
    command: 'insertDate',
    group: 'insert',
  },

  onCommand(command: string, value: any, editor: EditorCore): boolean {
    if (command === 'insertDate') {
      const date = new Date().toLocaleDateString();
      editor.insertText(date);
      editor.focus();
      return true;
    }
    return false;
  },
};
```

## Complex Plugin Example: Emoji Picker

```typescript
import React, { useState } from 'react';
import type { EditorPlugin, EditorCore } from '../types';

const emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃'];

export const EmojiPlugin: EditorPlugin = {
  name: 'emoji',

  toolbar: {
    icon: <>😀</>,
    label: 'Emoji',
    title: 'Insert emoji',
    command: 'showEmojiPicker',
    group: 'insert',
  },

  onCommand(command: string, value?: any): boolean {
    if (command === 'showEmojiPicker') {
      // Show picker (in real implementation, use a modal/dropdown)
      const emoji = prompt('Enter emoji:');
      if (emoji) {
        document.execCommand('insertText', false, emoji);
      }
      return true;
    }

    if (command === 'insertEmoji' && value) {
      document.execCommand('insertText', false, value);
      return true;
    }

    return false;
  },
};
```

## Best Practices

### 1. Return Values

- `onCommand`, `onKeyDown`, `onPaste`, `onInput`: Return `true` if the event was handled, `false` otherwise
- Returning `true` prevents other plugins from processing the same event

### 2. Focus Management

Always focus the editor after executing commands:

```typescript
onCommand(command: string, value: any, editor: EditorCore): boolean {
  if (command === 'myCommand') {
    // Do something
    editor.focus(); // Always focus after command
    return true;
  }
  return false;
}
```

### 3. Sanitize Input

Always sanitize user input before inserting HTML:

```typescript
import { sanitizeHTML } from '../utils/sanitize';

onCommand(command: string, value: any): boolean {
  if (command === 'insertHTML') {
    const clean = sanitizeHTML(value);
    document.execCommand('insertHTML', false, clean);
    return true;
  }
  return false;
}
```

### 4. Check Selection

Check if there's a selection before operating on it:

```typescript
import { hasSelection } from '../utils/selection';

onCommand(command: string): boolean {
  if (command === 'format' && hasSelection()) {
    // Only execute if text is selected
    // ...
    return true;
  }
  return false;
}
```

### 5. Error Handling

Wrap document.execCommand in try-catch:

```typescript
onCommand(command: string): boolean {
  try {
    document.execCommand('bold');
    return true;
  } catch (error) {
    console.error('Command failed:', error);
    return false;
  }
}
```

## Plugin Lifecycle

1. **Mount**: `onInit()` called when editor mounts
2. **Interaction**: User clicks toolbar, types, pastes
   - `onCommand()` for button clicks
   - `onKeyDown()` for keyboard shortcuts
   - `onPaste()` for paste events
   - `onInput()` for text input
3. **State Updates**: `isActive()` and `isDisabled()` called on selection change
4. **Unmount**: `onDestroy()` called when editor unmounts

## Testing Plugins

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Editor } from '../Editor';
import { MyPlugin } from './MyPlugin';

describe('MyPlugin', () => {
  it('should appear in toolbar', () => {
    render(<Editor plugins={[MyPlugin]} />);
    expect(screen.getByLabelText('My Plugin')).toBeInTheDocument();
  });

  it('should execute command on click', async () => {
    render(<Editor plugins={[MyPlugin]} />);
    const button = screen.getByLabelText('My Plugin');

    await userEvent.click(button);

    // Assert expected behavior
  });
});
```

## Publishing Plugins

To make your plugin available to other developers:

1. **Export from plugins/index.ts**:

```typescript
export { MyPlugin } from './MyPlugin';
```

2. **Document usage** in README.md

3. **Add examples** showing how to use the plugin

4. **Write tests** to ensure it works correctly

## Examples Gallery

See the built-in plugins for more examples:

- **BoldPlugin.tsx**: Simple formatting with keyboard shortcut
- **LinkPlugin.tsx**: Prompt for input, check selection state
- **ImagePlugin.tsx**: Insert custom HTML elements
- **HeadingPlugin.tsx**: Multiple related plugins (H1, H2, H3)

## Need Help?

- Check the [main README](./README.md) for API documentation
- Look at existing plugin implementations in `plugins/`
- Review utility functions in `utils/`
