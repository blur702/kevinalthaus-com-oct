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

  const codeFontFamily = '"Fira Code", "Courier New", monospace';

  if (editMode) {
    return (
      <div className="code-widget-editor">
        <style>{`
          .code-widget-editor { padding: 16px; border: 1px solid #e0e0e0; }
          .section { margin-bottom: 12px; }
          .label { display: block; margin-bottom: 4px; font-weight: bold; }
          .textarea { width: 100%; min-height: 200px; padding: 12px; font-family: ${codeFontFamily}; font-size: 14px; background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 4px; }
          .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
          .input { width: 100%; padding: 8px; }
          .range { width: 100%; }
          .checkbox-inline { display: flex; align-items: center; gap: 8px; }
        `}</style>
        <div className="section">
          <label htmlFor="code" className="label">
            Code:
          </label>
          <textarea
            id="code"
            value={config.code}
            onChange={(e) => handleConfigChange({ code: e.target.value })}
            className="textarea"
            placeholder="Paste your code here..."
          />
        </div>

        <div className="grid-3">
          <div>
            <label htmlFor="language" className="label">
              Language:
            </label>
            <input
              id="language"
              type="text"
              value={config.language}
              onChange={(e) => handleConfigChange({ language: e.target.value })}
              className="input"
              placeholder="javascript"
            />
          </div>

          <div>
            <label htmlFor="theme" className="label">
              Theme:
            </label>
            <select
              id="theme"
              value={config.theme}
              onChange={(e) => handleConfigChange({ theme: e.target.value as any })}
              className="input"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div>
            <label htmlFor="fontSize" className="label">
              Font Size: {config.fontSize}px
            </label>
            <input
              id="fontSize"
              type="range"
              min="10"
              max="24"
              value={config.fontSize}
              onChange={(e) => handleConfigChange({ fontSize: parseInt(e.target.value) })}
              className="range"
            />
          </div>
        </div>

        <div className="section">
          <label className="checkbox-inline">
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
    <div className={`code-widget code-${widget.id}`}>
      <style>{`
        .code-${widget.id} { position: relative; }
        .code-${widget.id} .copy-btn { position: absolute; top: 8px; right: 8px; padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; z-index: 1; }
        .code-${widget.id} .copy-btn.theme-dark { background-color: #3e4451; color: #abb2bf; }
        .code-${widget.id} .copy-btn.theme-light { background-color: #e0e0e0; color: #333; }
        .code-${widget.id} .code-block { background-color: ${config.theme === 'dark' ? '#282c34' : '#f5f5f5'}; color: ${config.theme === 'dark' ? '#abb2bf' : '#333'}; padding: 16px; border-radius: 4px; overflow: auto; font-size: ${config.fontSize}px; font-family: ${codeFontFamily}; }
        .code-${widget.id} .code-line { display: flex; }
        .code-${widget.id} .line-number { min-width: 40px; margin-right: 16px; text-align: right; opacity: 0.5; user-select: none; }
        .code-${widget.id} .lang-label { font-size: 12px; color: #666; margin-top: 4px; font-family: monospace; }
      `}</style>
      <button
        onClick={handleCopy}
        className={`copy-btn theme-${config.theme}`}
        aria-label="Copy code to clipboard"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>

      <pre className="code-block">
        <code>
          {config.showLineNumbers ? (
            lines.map((line, index) => (
              <div key={index} className="code-line">
                <span className="line-number">
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

      <div className="lang-label">
        {config.language}
      </div>
    </div>
  );
}
