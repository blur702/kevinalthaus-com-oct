/**
 * Core type definitions for the custom WYSIWYG editor
 */

import { ReactNode } from 'react';

/**
 * Editor command that can be executed
 */
export interface EditorCommand {
  name: string;
  value?: string | boolean | null;
}

/**
 * Selection range information
 */
export interface EditorSelection {
  range: Range | null;
  collapsed: boolean;
  startContainer: Node | null;
  endContainer: Node | null;
  commonAncestor: Node | null;
}

/**
 * Toolbar button configuration
 */
export interface ToolbarButton {
  id: string;
  icon: ReactNode;
  label: string;
  title?: string;
  command?: string;
  shortcut?: string;
  isActive?: (editor: EditorCore) => boolean;
  isDisabled?: (editor: EditorCore) => boolean;
  onClick?: (editor: EditorCore) => void;
}

/**
 * Plugin configuration for toolbar
 */
export interface PluginToolbarConfig {
  icon: ReactNode;
  label: string;
  title?: string;
  shortcut?: string;
  command?: string;
  group?: string; // Group buttons together (e.g., 'formatting', 'insert')
}

/**
 * Base plugin interface - all plugins must implement this
 */
export interface EditorPlugin {
  /** Unique plugin name */
  name: string;

  /** Toolbar button configuration (if plugin adds a toolbar button) */
  toolbar?: PluginToolbarConfig;

  /** Initialize plugin when editor mounts */
  onInit?(editor: EditorCore): void;

  /** Handle custom commands */
  onCommand?(command: string, value?: any): boolean | void;

  /** Handle keyboard shortcuts */
  onKeyDown?(event: KeyboardEvent, editor: EditorCore): boolean | void;

  /** Handle paste events (for custom paste handling) */
  onPaste?(event: ClipboardEvent, editor: EditorCore): boolean | void;

  /** Handle input events (for auto-formatting, etc.) */
  onInput?(event: InputEvent, editor: EditorCore): boolean | void;

  /** Check if plugin command is currently active (for toolbar button states) */
  isActive?(editor: EditorCore): boolean;

  /** Check if plugin command is currently disabled */
  isDisabled?(editor: EditorCore): boolean;

  /** Cleanup when editor unmounts */
  onDestroy?(): void;
}

/**
 * Editor core class interface - provides API for plugins
 */
export interface EditorCore {
  /** Get the contenteditable element */
  getElement(): HTMLDivElement | null;

  /** Get current HTML content */
  getContent(): string;

  /** Set HTML content */
  setContent(html: string): void;

  /** Execute a command */
  executeCommand(command: string, value?: any): boolean;

  /** Get current selection */
  getSelection(): EditorSelection | null;

  /** Set selection/cursor position */
  setSelection(range: Range): void;

  /** Insert HTML at current cursor position */
  insertHTML(html: string): void;

  /** Insert text at current cursor position */
  insertText(text: string): void;

  /** Check if a command is currently active */
  queryCommandState(command: string): boolean;

  /** Register a plugin */
  registerPlugin(plugin: EditorPlugin): void;

  /** Unregister a plugin */
  unregisterPlugin(pluginName: string): void;

  /** Get all registered plugins */
  getPlugins(): EditorPlugin[];

  /** Focus the editor */
  focus(): void;

  /** Blur the editor */
  blur(): void;
}

/**
 * Editor props
 */
export interface EditorProps {
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

/**
 * Toolbar props
 */
export interface EditorToolbarProps {
  editor: EditorCore | null;
  plugins: EditorPlugin[];
  className?: string;
}

/**
 * Storage format options
 */
export type StorageFormat = 'html' | 'markdown';

/**
 * Storage options
 */
export interface StorageOptions {
  format: StorageFormat;
  sanitize?: boolean;
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
}
