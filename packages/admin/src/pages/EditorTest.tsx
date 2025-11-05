/**
 * Editor Test Page
 *
 * Test page for the custom WYSIWYG editor with all plugins
 */

import React, { useState } from 'react';
import {
  Editor,
  BoldPlugin,
  ItalicPlugin,
  Heading1Plugin,
  LinkPlugin,
  ImagePlugin,
} from '../components/editor';

const EditorTest: React.FC = () => {
  const [content, setContent] = useState('<p>Test the editor here...</p>');
  const [showHTML, setShowHTML] = useState(false);

  const handleClear = () => {
    setContent('');
  };

  const handleLoadSample = () => {
    setContent(`
      <h1>Welcome to the Editor</h1>
      <p>This is a <strong>bold</strong> and <em>italic</em> text.</p>
      <h2>Features</h2>
      <ul>
        <li>Bold and italic formatting</li>
        <li>Headings (H1, H2, H3)</li>
        <li>Links and images</li>
      </ul>
      <p>Try editing this content!</p>
    `);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 data-testid="editor-test-title">Editor Test Page</h1>
      <p>Test the custom WYSIWYG editor with all plugins.</p>

      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
        <button
          onClick={handleClear}
          data-testid="clear-button"
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            border: '1px solid #ccc',
            background: '#f9f9f9',
            cursor: 'pointer',
          }}
        >
          Clear
        </button>

        <button
          onClick={handleLoadSample}
          data-testid="load-sample-button"
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            border: '1px solid #ccc',
            background: '#f9f9f9',
            cursor: 'pointer',
          }}
        >
          Load Sample
        </button>

        <button
          onClick={() => setShowHTML(!showHTML)}
          data-testid="toggle-html-button"
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            border: '1px solid #ccc',
            background: '#f9f9f9',
            cursor: 'pointer',
          }}
        >
          {showHTML ? 'Hide HTML' : 'Show HTML'}
        </button>
      </div>

      <div data-testid="editor-container">
        <Editor
          value={content}
          onChange={setContent}
          plugins={[
            BoldPlugin,
            ItalicPlugin,
            Heading1Plugin,
            LinkPlugin,
            ImagePlugin,
          ]}
          placeholder="Start typing..."
          minHeight="400px"
        />
      </div>

      {showHTML && (
        <div
          data-testid="html-output"
          style={{
            marginTop: '2rem',
            padding: '1rem',
            background: '#f5f5f5',
            borderRadius: '4px',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          <h3>HTML Output:</h3>
          <pre>{content}</pre>
        </div>
      )}

      <div
        data-testid="content-preview"
        style={{
          marginTop: '2rem',
          padding: '1rem',
          border: '1px solid #ccc',
          borderRadius: '4px',
        }}
      >
        <h3>Preview:</h3>
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </div>
  );
};

export default EditorTest;
