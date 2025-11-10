import React from 'react';
import { WidgetInstance, WidgetConfig } from '../../src/types';
import { DividerConfig } from './types';

interface DividerProps {
  widget: WidgetInstance;
  editMode: boolean;
  onChange?: (config: WidgetConfig) => void;
}

export default function Divider({ widget, editMode, onChange }: DividerProps) {
  const config = widget.config as DividerConfig;

  const handleConfigChange = (updates: Partial<DividerConfig>) => {
    if (onChange) {
      onChange({ ...config, ...updates });
    }
  };

  const containerStyle: React.CSSProperties = {
    marginTop: `${config.marginTop}px`,
    marginBottom: `${config.marginBottom}px`,
    textAlign: config.alignment
  };

  const hrStyle: React.CSSProperties = {
    width: `${config.width}%`,
    borderStyle: config.style,
    borderWidth: `${config.thickness}px 0 0 0`,
    borderColor: config.color,
    margin: 0,
    display: 'inline-block'
  };

  if (editMode) {
    return (
      <div className="divider-editor" style={{ padding: '16px', border: '1px solid #e0e0e0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label htmlFor="style" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Line Style:
            </label>
            <select
              id="style"
              value={config.style}
              onChange={(e) => handleConfigChange({ style: e.target.value as any })}
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
              <option value="double">Double</option>
            </select>
          </div>

          <div>
            <label htmlFor="alignment" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Alignment:
            </label>
            <select
              id="alignment"
              value={config.alignment}
              onChange={(e) => handleConfigChange({ alignment: e.target.value as any })}
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>

          <div>
            <label htmlFor="width" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Width: {config.width}%
            </label>
            <input
              id="width"
              type="range"
              min="10"
              max="100"
              value={config.width}
              onChange={(e) => handleConfigChange({ width: parseInt(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label htmlFor="thickness" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Thickness: {config.thickness}px
            </label>
            <input
              id="thickness"
              type="range"
              min="1"
              max="20"
              value={config.thickness}
              onChange={(e) => handleConfigChange({ thickness: parseInt(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label htmlFor="color" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Color:
            </label>
            <input
              id="color"
              type="color"
              value={config.color}
              onChange={(e) => handleConfigChange({ color: e.target.value })}
              style={{ width: '100%', height: '36px' }}
            />
          </div>

          <div></div>

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

        {/* Preview */}
        <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', fontSize: '12px', color: '#666' }}>Preview:</p>
          <div style={containerStyle}>
            <hr style={hrStyle} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="divider-widget" style={containerStyle} role="separator">
      <hr style={hrStyle} />
    </div>
  );
}
