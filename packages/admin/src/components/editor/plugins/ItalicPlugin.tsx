/**
 * Italic Plugin
 *
 * Adds italic formatting capability (Ctrl+I / Cmd+I)
 */

import React from 'react';
import type { EditorPlugin, EditorCore } from '../types';

/**
 * Italic icon component
 */
const ItalicIcon: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6 2h6v2H9.5l-2 8H10v2H4v-2h2.5l2-8H6V2z"
      fill="currentColor"
    />
  </svg>
);

/**
 * Italic Plugin
 */
export const ItalicPlugin: EditorPlugin = {
  name: 'italic',

  toolbar: {
    icon: <ItalicIcon />,
    label: 'Italic',
    title: 'Italic (Ctrl+I)',
    command: 'italic',
    shortcut: 'Ctrl+I',
    group: 'formatting',
  },

  onKeyDown(event: KeyboardEvent, editor: EditorCore): boolean {
    // Handle Ctrl+I (Windows/Linux) or Cmd+I (Mac)
    if ((event.ctrlKey || event.metaKey) && event.key === 'i') {
      editor.executeCommand('italic');
      return true; // Handled
    }
    return false;
  },

  isActive(editor: EditorCore): boolean {
    return editor.queryCommandState('italic');
  },
};

export default ItalicPlugin;
