import React, { useState } from 'react';
import { WidgetInstance, WidgetConfig } from '../../src/types';
import { CodeConfig } from './types';

interface CodeWidgetProps {
  widget: WidgetInstance;
  editMode: boolean;
  onChange?: (config: WidgetConfig) => void;
}

export default function CodeWidget({ widget, editMode, onChange }: CodeWidgetProps) {
  const config = widget.config as CodeConfig;
  const [copied, setCopied] = useState(false);

  const handleConfigChange = (updates: Partial<CodeConfig>) => {
    if (onChange) {
      onChange({ ...config, ...updates });
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(config.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const codeBlockStyle: React.CSSProperties = {
    backgroundColor: config.theme === 'dark' ? '#282c34' : '#f5f5f5',
    color: config.theme === 'dark' ? '#abb2bf' : '#333',
    padding: '16px',
    borderRadius: '4px',
    overflow: 'auto',
    fontSize: `${config.fontSize}px`,
    fontFamily: '"Fira Code", "Courier New", monospace',
    position: 'relative'
  };

  if (editMode) {
    return (
      <div className="code-widget-editor" style={{ padding: '16px', border: '1px solid #e0e0e0' }}>
        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="code" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Code:
          </label>
          <textarea
            id="code"
            value={config.code}
            onChange={(e) => handleConfigChange({ code: e.target.value })}
            style={{
              width: '100%',
              minHeight: '200px',
              padding: '12px',
              fontFamily: '"Fira Code", "Courier New", monospace',
              fontSize: '14px',
              backgroundColor: '#f9f9f9',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
            placeholder="Paste your code here..."
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <div>
            <label htmlFor="language" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Language:
            </label>
            <input
              id="language"
              type="text"
              value={config.language}
              onChange={(e) => handleConfigChange({ language: e.target.value })}
              style={{ width: '100%', padding: '8px' }}
              placeholder="javascript"
            />
          </div>

          <div>
            <label htmlFor="theme" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Theme:
            </label>
            <select
              id="theme"
              value={config.theme}
              onChange={(e) => handleConfigChange({ theme: e.target.value as any })}
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div>
            <label htmlFor="fontSize" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Font Size: {config.fontSize}px
            </label>
            <input
              id="fontSize"
              type="range"
              min="10"
              max="24"
              value={config.fontSize}
              onChange={(e) => handleConfigChange({ fontSize: parseInt(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div style={{ marginTop: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={config.showLineNumbers}
              onChange={(e) => handleConfigChange({ showLineNumbers: e.target.checked })}
            />
            <span>Show line numbers</span>
          </label>
        </div>
      </div>
    );
  }

  const lines = config.code.split('\n');

  return (
    <div className="code-widget" style={{ position: 'relative' }}>
      <button
        onClick={handleCopy}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          padding: '6px 12px',
          backgroundColor: config.theme === 'dark' ? '#3e4451' : '#e0e0e0',
          color: config.theme === 'dark' ? '#abb2bf' : '#333',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
          zIndex: 1
        }}
        aria-label="Copy code to clipboard"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>

      <pre style={codeBlockStyle}>
        <code>
          {config.showLineNumbers ? (
            lines.map((line, index) => (
              <div key={index} style={{ display: 'flex' }}>
                <span style={{
                  minWidth: '40px',
                  marginRight: '16px',
                  textAlign: 'right',
                  opacity: 0.5,
                  userSelect: 'none'
                }}>
                  {index + 1}
                </span>
                <span>{line}</span>
              </div>
            ))
          ) : (
            config.code
          )}
        </code>
      </pre>

      <div style={{
        fontSize: '12px',
        color: '#666',
        marginTop: '4px',
        fontFamily: 'monospace'
      }}>
        {config.language}
      </div>
    </div>
  );
}
