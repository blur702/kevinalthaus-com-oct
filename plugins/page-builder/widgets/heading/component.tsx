import React from 'react';
import { WidgetInstance, WidgetConfig } from '../../src/types';
import { HeadingConfig } from './types';

interface HeadingProps {
  widget: WidgetInstance;
  editMode: boolean;
  onChange?: (config: WidgetConfig) => void;
}

export default function Heading({ widget, editMode, onChange }: HeadingProps) {
  const config = widget.config as HeadingConfig;

  const handleConfigChange = (updates: Partial<HeadingConfig>) => {
    if (onChange) {
      onChange({ ...config, ...updates });
    }
  };

  const headingStyle: React.CSSProperties = {
    textAlign: config.textAlign,
    fontSize: config.fontSize ? `${config.fontSize}px` : undefined,
    fontWeight: config.fontWeight,
    color: config.textColor,
    marginTop: `${config.marginTop}px`,
    marginBottom: `${config.marginBottom}px`
  };

  if (editMode) {
    return (
      <div className="heading-editor" style={{ padding: '16px', border: '1px solid #e0e0e0' }}>
        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="text" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Heading Text:
          </label>
          <input
            id="text"
            type="text"
            value={config.text}
            onChange={(e) => handleConfigChange({ text: e.target.value })}
            style={{ width: '100%', padding: '8px', fontSize: '16px' }}
            placeholder="Enter heading text"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label htmlFor="level" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Heading Level:
            </label>
            <select
              id="level"
              value={config.level}
              onChange={(e) => handleConfigChange({ level: parseInt(e.target.value) as any })}
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="1">H1 - Main Title</option>
              <option value="2">H2 - Section</option>
              <option value="3">H3 - Subsection</option>
              <option value="4">H4 - Minor Heading</option>
              <option value="5">H5 - Small Heading</option>
              <option value="6">H6 - Smallest</option>
            </select>
          </div>

          <div>
            <label htmlFor="textAlign" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Alignment:
            </label>
            <select
              id="textAlign"
              value={config.textAlign}
              onChange={(e) => handleConfigChange({ textAlign: e.target.value as any })}
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>

          <div>
            <label htmlFor="fontSize" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Font Size (optional): {config.fontSize || 'Auto'}px
            </label>
            <input
              id="fontSize"
              type="range"
              min="12"
              max="120"
              value={config.fontSize || 32}
              onChange={(e) => handleConfigChange({ fontSize: parseInt(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label htmlFor="fontWeight" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Font Weight:
            </label>
            <select
              id="fontWeight"
              value={config.fontWeight}
              onChange={(e) => handleConfigChange({ fontWeight: e.target.value as any })}
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="100">Thin (100)</option>
              <option value="200">Extra Light (200)</option>
              <option value="300">Light (300)</option>
              <option value="400">Normal (400)</option>
              <option value="500">Medium (500)</option>
              <option value="600">Semi Bold (600)</option>
              <option value="700">Bold (700)</option>
              <option value="800">Extra Bold (800)</option>
              <option value="900">Black (900)</option>
            </select>
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
            <label htmlFor="marginTop" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Margin Top: {config.marginTop}px
            </label>
            <input
              id="marginTop"
              type="range"
              min="0"
              max="100"
              value={config.marginTop}
              onChange={(e) => handleConfigChange({ marginTop: parseInt(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label htmlFor="marginBottom" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Margin Bottom: {config.marginBottom}px
            </label>
            <input
              id="marginBottom"
              type="range"
              min="0"
              max="100"
              value={config.marginBottom}
              onChange={(e) => handleConfigChange({ marginBottom: parseInt(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>
    );
  }

  const HeadingTag = `h${config.level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

  return (
    <HeadingTag className="heading-widget" style={headingStyle}>
      {config.text}
    </HeadingTag>
  );
}
