/**
 * Bold Plugin
 *
 * Adds bold formatting capability (Ctrl+B / Cmd+B)
 */

import React from 'react';
import type { EditorPlugin, EditorCore } from '../types';

/**
 * Bold icon component
 */
const BoldIcon: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4 2v12h5.5a3.5 3.5 0 001.667-6.556A3.5 3.5 0 009.5 2H4zm2 2h3.5a1.5 1.5 0 110 3H6V4zm0 5h4a1.5 1.5 0 110 3H6V9z"
      fill="currentColor"
    />
  </svg>
);

/**
 * Bold Plugin
 */
export const BoldPlugin: EditorPlugin = {
  name: 'bold',

  toolbar: {
    icon: <BoldIcon />,
    label: 'Bold',
    title: 'Bold (Ctrl+B)',
    command: 'bold',
    shortcut: 'Ctrl+B',
    group: 'formatting',
  },

  onKeyDown(event: KeyboardEvent, editor: EditorCore): boolean {
    // Handle Ctrl+B (Windows/Linux) or Cmd+B (Mac)
    if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
      editor.executeCommand('bold');
      return true; // Handled
    }
    return false;
  },

  isActive(editor: EditorCore): boolean {
    return editor.queryCommandState('bold');
  },
};

export default BoldPlugin;
