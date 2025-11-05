/**
 * EditorToolbar - Toolbar component for the editor
 *
 * Renders toolbar buttons from loaded plugins
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { EditorToolbarProps, EditorPlugin, ToolbarButton } from './types';

/**
 * EditorToolbar component
 */
export const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor, plugins, className = '' }) => {
  const [activeStates, setActiveStates] = useState<Map<string, boolean>>(new Map());
  const [disabledStates, setDisabledStates] = useState<Map<string, boolean>>(new Map());

  /**
   * Update button states (active/disabled)
   */
  const updateButtonStates = useCallback(() => {
    if (!editor) {
      return;
    }

    const newActiveStates = new Map<string, boolean>();
    const newDisabledStates = new Map<string, boolean>();

    for (const plugin of plugins) {
      if (plugin.toolbar) {
        // Check if plugin is active
        if (plugin.isActive) {
          newActiveStates.set(plugin.name, plugin.isActive(editor));
        }

        // Check if plugin is disabled
        if (plugin.isDisabled) {
          newDisabledStates.set(plugin.name, plugin.isDisabled(editor));
        }
      }
    }

    setActiveStates(newActiveStates);
    setDisabledStates(newDisabledStates);
  }, [editor, plugins]);

  /**
   * Handle button click
   */
  const handleButtonClick = useCallback(
    (plugin: EditorPlugin) => {
      if (!editor) {
        return;
      }

      // Focus editor first
      editor.focus();

      // Execute plugin command
      if (plugin.toolbar?.command) {
        editor.executeCommand(plugin.toolbar.command);
      }

      // Update button states
      updateButtonStates();
    },
    [editor, updateButtonStates]
  );

  /**
   * Update button states when selection changes
   */
  useEffect(() => {
    if (!editor) {
      return;
    }

    // Update states on selection change
    const handleSelectionChange = () => {
      updateButtonStates();
    };

    document.addEventListener('selectionchange', handleSelectionChange);

    // Initial update
    updateButtonStates();

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [editor, updateButtonStates]);

  // Group plugins by their toolbar group
  const groupedPlugins = plugins.reduce((groups, plugin) => {
    if (!plugin.toolbar) {
      return groups;
    }

    const group = plugin.toolbar.group || 'default';

    if (!groups[group]) {
      groups[group] = [];
    }

    groups[group].push(plugin);
    return groups;
  }, {} as Record<string, EditorPlugin[]>);

  // Render toolbar
  return (
    <div className={`editor-toolbar ${className}`}>
      {Object.entries(groupedPlugins).map(([group, groupPlugins]) => (
        <div key={group} className="editor-toolbar-group" data-group={group}>
          {groupPlugins.map(plugin => {
            if (!plugin.toolbar) {
              return null;
            }

            const isActive = activeStates.get(plugin.name) || false;
            const isDisabled = disabledStates.get(plugin.name) || false;

            const buttonClass = [
              'editor-toolbar-button',
              isActive ? 'active' : '',
              isDisabled ? 'disabled' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <button
                key={plugin.name}
                type="button"
                className={buttonClass}
                title={plugin.toolbar.title || plugin.toolbar.label}
                disabled={isDisabled}
                onClick={() => handleButtonClick(plugin)}
                aria-label={plugin.toolbar.label}
                aria-pressed={isActive}
              >
                {plugin.toolbar.icon}
                {plugin.toolbar.shortcut && (
                  <span className="editor-toolbar-button-shortcut">{plugin.toolbar.shortcut}</span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default EditorToolbar;
