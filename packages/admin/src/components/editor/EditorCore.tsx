/**
 * EditorCore - The main contenteditable component
 *
 * This is the core editor component that manages:
 * - Contenteditable element and state
 * - Plugin registration and lifecycle
 * - Command execution
 * - Selection/range management
 * - Event handling (input, keydown, paste)
 */

import React, { useRef, useState, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
import type { EditorProps, EditorCore as EditorCoreInterface, EditorPlugin, EditorSelection } from './types';

/**
 * EditorCore component implementation
 */
const EditorCoreComponent = forwardRef<EditorCoreInterface, EditorProps>((props, ref) => {
  const {
    value = '',
    onChange,
    plugins = [],
    placeholder = 'Start typing...',
    className = '',
    readOnly = false,
    autoFocus = false,
    minHeight = '200px',
    maxHeight = 'none',
  } = props;

  // Refs
  const editorRef = useRef<HTMLDivElement>(null);
  const pluginsRef = useRef<Map<string, EditorPlugin>>(new Map());
  const isUpdatingRef = useRef(false);

  // State
  const [isFocused, setIsFocused] = useState(false);

  /**
   * Get the contenteditable element
   */
  const getElement = useCallback((): HTMLDivElement | null => {
    return editorRef.current;
  }, []);

  /**
   * Get current HTML content
   */
  const getContent = useCallback((): string => {
    return editorRef.current?.innerHTML || '';
  }, []);

  /**
   * Set HTML content
   */
  const setContent = useCallback((html: string): void => {
    if (editorRef.current && !isUpdatingRef.current) {
      isUpdatingRef.current = true;
      editorRef.current.innerHTML = html;
      isUpdatingRef.current = false;
    }
  }, []);

  /**
   * Execute a document command
   */
  const executeCommand = useCallback((command: string, value?: any): boolean => {
    // First, check if any plugin wants to handle this command
    for (const plugin of pluginsRef.current.values()) {
      if (plugin.onCommand) {
        const handled = plugin.onCommand(command, value);
        if (handled) {
          return true;
        }
      }
    }

    // Fall back to native execCommand
    try {
      return document.execCommand(command, false, value);
    } catch (error) {
      console.error(`Failed to execute command "${command}":`, error);
      return false;
    }
  }, []);

  /**
   * Get current selection
   */
  const getSelection = useCallback((): EditorSelection | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);

    return {
      range,
      collapsed: range.collapsed,
      startContainer: range.startContainer,
      endContainer: range.endContainer,
      commonAncestor: range.commonAncestorContainer,
    };
  }, []);

  /**
   * Set selection/cursor position
   */
  const setSelection = useCallback((range: Range): void => {
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }, []);

  /**
   * Insert HTML at current cursor position
   */
  const insertHTML = useCallback((html: string): void => {
    executeCommand('insertHTML', html);
  }, [executeCommand]);

  /**
   * Insert text at current cursor position
   */
  const insertText = useCallback((text: string): void => {
    executeCommand('insertText', text);
  }, [executeCommand]);

  /**
   * Check if a command is currently active
   */
  const queryCommandState = useCallback((command: string): boolean => {
    try {
      return document.queryCommandState(command);
    } catch (error) {
      return false;
    }
  }, []);

  /**
   * Register a plugin
   */
  const registerPlugin = useCallback((plugin: EditorPlugin): void => {
    pluginsRef.current.set(plugin.name, plugin);

    // Call plugin's onInit if it exists
    if (plugin.onInit) {
      plugin.onInit(editorCore);
    }
  }, []);

  /**
   * Unregister a plugin
   */
  const unregisterPlugin = useCallback((pluginName: string): void => {
    const plugin = pluginsRef.current.get(pluginName);

    // Call plugin's onDestroy if it exists
    if (plugin?.onDestroy) {
      plugin.onDestroy();
    }

    pluginsRef.current.delete(pluginName);
  }, []);

  /**
   * Get all registered plugins
   */
  const getPlugins = useCallback((): EditorPlugin[] => {
    return Array.from(pluginsRef.current.values());
  }, []);

  /**
   * Focus the editor
   */
  const focus = useCallback((): void => {
    editorRef.current?.focus();
  }, []);

  /**
   * Blur the editor
   */
  const blur = useCallback((): void => {
    editorRef.current?.blur();
  }, []);

  // Create the EditorCore API object
  const editorCore: EditorCoreInterface = {
    getElement,
    getContent,
    setContent,
    executeCommand,
    getSelection,
    setSelection,
    insertHTML,
    insertText,
    queryCommandState,
    registerPlugin,
    unregisterPlugin,
    getPlugins,
    focus,
    blur,
  };

  // Expose API via ref
  useImperativeHandle(ref, () => editorCore, [editorCore]);

  /**
   * Handle input events
   */
  const handleInput = useCallback((event: React.FormEvent<HTMLDivElement>) => {
    if (isUpdatingRef.current || readOnly) {
      return;
    }

    const content = getContent();

    // Notify plugins
    const nativeEvent = event.nativeEvent as InputEvent;
    for (const plugin of pluginsRef.current.values()) {
      if (plugin.onInput) {
        plugin.onInput(nativeEvent, editorCore);
      }
    }

    // Notify parent
    if (onChange) {
      onChange(content);
    }
  }, [readOnly, getContent, onChange, editorCore]);

  /**
   * Handle keydown events
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (readOnly) {
      event.preventDefault();
      return;
    }

    // Let plugins handle keyboard shortcuts
    const nativeEvent = event.nativeEvent as KeyboardEvent;
    for (const plugin of pluginsRef.current.values()) {
      if (plugin.onKeyDown) {
        const handled = plugin.onKeyDown(nativeEvent, editorCore);
        if (handled) {
          event.preventDefault();
          return;
        }
      }
    }
  }, [readOnly, editorCore]);

  /**
   * Handle paste events
   */
  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    if (readOnly) {
      event.preventDefault();
      return;
    }

    // Let plugins handle paste
    const nativeEvent = event.nativeEvent as ClipboardEvent;
    for (const plugin of pluginsRef.current.values()) {
      if (plugin.onPaste) {
        const handled = plugin.onPaste(nativeEvent, editorCore);
        if (handled) {
          event.preventDefault();
          return;
        }
      }
    }

    // Default behavior: paste as plain text
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    insertText(text);
  }, [readOnly, insertText, editorCore]);

  /**
   * Handle focus
   */
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  /**
   * Handle blur
   */
  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  /**
   * Initialize plugins on mount
   */
  useEffect(() => {
    // Register all plugins
    plugins.forEach(plugin => {
      registerPlugin(plugin);
    });

    // Cleanup on unmount
    return () => {
      // Unregister all plugins
      pluginsRef.current.forEach(plugin => {
        if (plugin.onDestroy) {
          plugin.onDestroy();
        }
      });
      pluginsRef.current.clear();
    };
  }, [plugins, registerPlugin]);

  /**
   * Update content when value prop changes
   */
  useEffect(() => {
    if (value !== getContent() && !isUpdatingRef.current) {
      setContent(value);
    }
  }, [value, getContent, setContent]);

  /**
   * Auto focus on mount
   */
  useEffect(() => {
    if (autoFocus) {
      focus();
    }
  }, [autoFocus, focus]);

  // Compute styles
  const editorStyles: React.CSSProperties = {
    minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight,
    maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
    overflow: 'auto',
  };

  // Compute classes
  const editorClasses = [
    'editor-core',
    className,
    isFocused ? 'editor-focused' : '',
    readOnly ? 'editor-readonly' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={editorRef}
      className={editorClasses}
      contentEditable={!readOnly}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onFocus={handleFocus}
      onBlur={handleBlur}
      data-placeholder={placeholder}
      style={editorStyles}
      suppressContentEditableWarning
    />
  );
});

EditorCoreComponent.displayName = 'EditorCore';

export default EditorCoreComponent;
