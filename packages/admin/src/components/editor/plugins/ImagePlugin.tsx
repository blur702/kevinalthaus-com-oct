/**
 * Image Plugin
 *
 * Adds image insertion capability with prompt for URL
 */

import React from 'react';
import type { EditorPlugin } from '../types';

/**
 * Image icon component
 */
const ImageIcon: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="2"
      y="2"
      width="12"
      height="12"
      rx="1"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <circle cx="5.5" cy="5.5" r="1" fill="currentColor" />
    <path
      d="M14 10l-3-3-3 3-2-2-4 4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Image Plugin
 */
export const ImagePlugin: EditorPlugin = {
  name: 'image',

  toolbar: {
    icon: <ImageIcon />,
    label: 'Image',
    title: 'Insert Image',
    command: 'insertImage',
    group: 'insert',
  },

  onCommand(command: string, _value?: any): boolean {
    if (command === 'insertImage') {
      // Prompt for image URL
      const url = prompt('Enter image URL:', 'https://');

      if (url && url.trim()) {
        // Create image element
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Image';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';

        // Insert image
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(img);

          // Move cursor after image
          range.setStartAfter(img);
          range.setEndAfter(img);
          selection.removeAllRanges();
          selection.addRange(range);
        }

        return true;
      }

      return false;
    }

    return false;
  },
};

export default ImagePlugin;
