/**
 * Link Plugin
 *
 * Adds hyperlink capability with prompt for URL
 */

import React from 'react';
import type { EditorPlugin, EditorCore } from '../types';
import { hasSelection } from '../utils/selection';

/**
 * Link icon component
 */
const LinkIcon: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M7.5 9.5a3 3 0 004.5-2.5 3 3 0 00-4.5-2.5M8.5 6.5a3 3 0 00-4.5 2.5 3 3 0 004.5 2.5M6 7h4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Link Plugin
 */
export const LinkPlugin: EditorPlugin = {
  name: 'link',

  toolbar: {
    icon: <LinkIcon />,
    label: 'Link',
    title: 'Insert Link (Ctrl+K)',
    command: 'createLink',
    shortcut: 'Ctrl+K',
    group: 'insert',
  },

  onCommand(command: string, value?: any): boolean {
    if (command === 'createLink') {
      // Prompt for URL
      const url = prompt('Enter URL:', 'https://');

      if (url && url.trim()) {
        // Create link
        document.execCommand('createLink', false, url);
        return true;
      }

      return false;
    }

    if (command === 'unlink') {
      document.execCommand('unlink');
      return true;
    }

    return false;
  },

  onKeyDown(event: KeyboardEvent, editor: EditorCore): boolean {
    // Handle Ctrl+K (Windows/Linux) or Cmd+K (Mac)
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      if (hasSelection()) {
        const url = prompt('Enter URL:', 'https://');

        if (url && url.trim()) {
          editor.executeCommand('createLink', url);
        }

        return true;
      }
    }

    return false;
  },

  isActive(editor: EditorCore): boolean {
    try {
      // Check if selection is within a link
      const selection = window.getSelection();
      if (!selection) return false;

      const node = selection.anchorNode;
      if (!node) return false;

      // Check if node or parent is an anchor tag
      let current: Node | null = node;
      while (current) {
        if (current.nodeName === 'A') {
          return true;
        }
        current = current.parentNode;
      }

      return false;
    } catch {
      return false;
    }
  },

  isDisabled(editor: EditorCore): boolean {
    // Disabled if no selection
    return !hasSelection();
  },
};

export default LinkPlugin;
