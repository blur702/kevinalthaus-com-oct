/**
 * Heading Plugin
 *
 * Adds heading (H1-H6) formatting capability
 */

import React, { useState } from 'react';
import type { EditorPlugin, EditorCore } from '../types';

/**
 * Heading icon component
 */
const HeadingIcon: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M2 2v12h2V9h4v5h2V2h-2v5H4V2H2z"
      fill="currentColor"
    />
  </svg>
);

/**
 * Heading Plugin with dropdown menu
 */
export const HeadingPlugin: EditorPlugin = {
  name: 'heading',

  toolbar: {
    icon: <HeadingIcon />,
    label: 'Heading',
    title: 'Heading',
    group: 'formatting',
  },

  onCommand(command: string, value?: any): boolean {
    if (command === 'heading' && typeof value === 'number') {
      // Format as heading level 1-6
      document.execCommand('formatBlock', false, `h${value}`);
      return true;
    }
    return false;
  },

  isActive(editor: EditorCore): boolean {
    // Check if we're in any heading
    const formats = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    try {
      const currentFormat = document.queryCommandValue('formatBlock').toLowerCase();
      return formats.includes(currentFormat);
    } catch {
      return false;
    }
  },
};

/**
 * Individual heading level plugins
 */

export const Heading1Plugin: EditorPlugin = {
  name: 'heading1',

  toolbar: {
    icon: <>H1</>,
    label: 'Heading 1',
    title: 'Heading 1',
    command: 'formatBlock',
    group: 'formatting',
  },

  onCommand(command: string): boolean {
    if (command === 'formatBlock') {
      document.execCommand('formatBlock', false, 'h1');
      return true;
    }
    return false;
  },

  isActive(editor: EditorCore): boolean {
    try {
      const currentFormat = document.queryCommandValue('formatBlock').toLowerCase();
      return currentFormat === 'h1';
    } catch {
      return false;
    }
  },
};

export const Heading2Plugin: EditorPlugin = {
  name: 'heading2',

  toolbar: {
    icon: <>H2</>,
    label: 'Heading 2',
    title: 'Heading 2',
    command: 'formatBlock',
    group: 'formatting',
  },

  onCommand(command: string): boolean {
    if (command === 'formatBlock') {
      document.execCommand('formatBlock', false, 'h2');
      return true;
    }
    return false;
  },

  isActive(editor: EditorCore): boolean {
    try {
      const currentFormat = document.queryCommandValue('formatBlock').toLowerCase();
      return currentFormat === 'h2';
    } catch {
      return false;
    }
  },
};

export const Heading3Plugin: EditorPlugin = {
  name: 'heading3',

  toolbar: {
    icon: <>H3</>,
    label: 'Heading 3',
    title: 'Heading 3',
    command: 'formatBlock',
    group: 'formatting',
  },

  onCommand(command: string): boolean {
    if (command === 'formatBlock') {
      document.execCommand('formatBlock', false, 'h3');
      return true;
    }
    return false;
  },

  isActive(editor: EditorCore): boolean {
    try {
      const currentFormat = document.queryCommandValue('formatBlock').toLowerCase();
      return currentFormat === 'h3';
    } catch {
      return false;
    }
  },
};

export default HeadingPlugin;
