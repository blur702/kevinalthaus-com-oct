/**
 * Custom WYSIWYG Editor - Main Export
 *
 * A plugin-based, extensible rich text editor built on contenteditable
 */

// Main components
export { default as Editor } from './Editor';
export { default as EditorCore } from './EditorCore';
export { default as EditorToolbar } from './EditorToolbar';

// Types
export type {
  EditorProps,
  EditorCore as EditorCoreInterface,
  EditorPlugin,
  EditorSelection,
  EditorCommand,
  ToolbarButton,
  PluginToolbarConfig,
  EditorToolbarProps,
  StorageFormat,
  StorageOptions,
} from './types';

// Utilities
export * from './utils';

// Built-in Plugins
export * from './plugins';
