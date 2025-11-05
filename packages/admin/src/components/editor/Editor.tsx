/**
 * Editor - Main WYSIWYG editor component
 *
 * Complete editor with toolbar and content area
 */

import React, { useRef } from 'react';
import EditorCore from './EditorCore';
import EditorToolbar from './EditorToolbar';
import type { EditorProps, EditorCore as EditorCoreInterface } from './types';
import './Editor.css';

/**
 * Main Editor component
 */
export const Editor: React.FC<EditorProps> = (props) => {
  const {
    plugins = [],
    className = '',
    ...coreProps
  } = props;

  const editorRef = useRef<EditorCoreInterface>(null);

  return (
    <div className={`editor-container ${className}`}>
      <EditorToolbar
        editor={editorRef.current}
        plugins={plugins}
        className="editor-toolbar-main"
      />
      <EditorCore
        ref={editorRef}
        {...coreProps}
        plugins={plugins}
      />
    </div>
  );
};

export default Editor;
