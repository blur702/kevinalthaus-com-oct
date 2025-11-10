import React from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { WidgetInstance, WidgetConfig } from '../../src/types';
import { TextContentConfig } from './types';

interface TextContentProps {
  widget: WidgetInstance;
  editMode: boolean;
  onChange?: (config: WidgetConfig) => void;
}

export default function TextContent({ widget, editMode, onChange }: TextContentProps) {
  const config = widget.config as TextContentConfig;

  const handleConfigChange = (updates: Partial<TextContentConfig>) => {
    if (onChange) {
      onChange({ ...config, ...updates });
    }
  };

  const containerStyle: React.CSSProperties = {
    textAlign: config.textAlign,
    fontSize: `${config.fontSize}px`,
    lineHeight: config.lineHeight,
    color: config.textColor,
    backgroundColor: config.backgroundColor,
    padding: `${config.padding}px`
  };

  if (editMode) {
    return (
      <div className="text-content-editor" style={{ padding: '16px', border: '1px solid #e0e0e0' }}>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Text Content:
          </label>
          <textarea
            value={config.content}
            onChange={(e) => handleConfigChange({ content: e.target.value })}
            style={{ width: '100%', minHeight: '150px', padding: '8px', fontFamily: 'inherit' }}
            placeholder="Enter rich text content (HTML supported)..."
            aria-label="Text content"
          />
          <small style={{ display: 'block', marginTop: '4px', color: '#666' }}>
            HTML formatting is supported (e.g., &lt;p&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;ul&gt;, &lt;ol&gt;)
          </small>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label htmlFor="textAlign" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Text Alignment:
            </label>
            <select
              id="textAlign"
              value={config.textAlign}
              onChange={(e) => handleConfigChange({ textAlign: e.target.value as any })}
              style={{ width: '100%', padding: '6px' }}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
              <option value="justify">Justify</option>
            </select>
          </div>

          <div>
            <label htmlFor="fontSize" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Font Size: {config.fontSize}px
            </label>
            <input
              id="fontSize"
              type="range"
              min="8"
              max="72"
              value={config.fontSize}
              onChange={(e) => handleConfigChange({ fontSize: parseInt(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label htmlFor="lineHeight" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Line Height: {config.lineHeight}
            </label>
            <input
              id="lineHeight"
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={config.lineHeight}
              onChange={(e) => handleConfigChange({ lineHeight: parseFloat(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label htmlFor="padding" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Padding: {config.padding}px
            </label>
            <input
              id="padding"
              type="range"
              min="0"
              max="100"
              value={config.padding}
              onChange={(e) => handleConfigChange({ padding: parseInt(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label htmlFor="textColor" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Text Color:
            </label>
            <input
              id="textColor"
              type="color"
              value={config.textColor || '#000000'}
              onChange={(e) => handleConfigChange({ textColor: e.target.value })}
              style={{ width: '100%', height: '36px' }}
            />
          </div>

          <div>
            <label htmlFor="backgroundColor" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Background Color:
            </label>
            <input
              id="backgroundColor"
              type="color"
              value={config.backgroundColor || '#ffffff'}
              onChange={(e) => handleConfigChange({ backgroundColor: e.target.value })}
              style={{ width: '100%', height: '36px' }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="text-content"
      style={containerStyle}
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(config.content) }}
      role="article"
      aria-label="Text content"
    />
  );
}
