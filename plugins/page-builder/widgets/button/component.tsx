import React from 'react';
import { WidgetInstance, WidgetConfig } from '../../src/types';
import { ButtonConfig } from './types';

interface ButtonWidgetProps {
  widget: WidgetInstance;
  editMode: boolean;
  onChange?: (config: WidgetConfig) => void;
}

export default function ButtonWidget({ widget, editMode, onChange }: ButtonWidgetProps) {
  const config = widget.config as ButtonConfig;

  const handleConfigChange = (updates: Partial<ButtonConfig>) => {
    if (onChange) {
      onChange({ ...config, ...updates });
    }
  };

  const getButtonStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      display: 'inline-block',
      padding: `${config.padding.vertical}px ${config.padding.horizontal}px`,
      borderRadius: `${config.borderRadius}px`,
      textDecoration: 'none',
      fontWeight: '600',
      cursor: 'pointer',
      border: '2px solid transparent',
      transition: 'all 0.3s ease',
      textAlign: 'center',
      width: config.fullWidth ? '100%' : 'auto'
    };

    // Size variations
    const sizeStyles = {
      small: { fontSize: '14px' },
      medium: { fontSize: '16px' },
      large: { fontSize: '18px' }
    };

    // Variant variations
    const variantStyles = {
      primary: {
        backgroundColor: config.backgroundColor || '#007bff',
        color: config.textColor || '#ffffff',
        border: '2px solid transparent'
      },
      secondary: {
        backgroundColor: config.backgroundColor || '#6c757d',
        color: config.textColor || '#ffffff',
        border: '2px solid transparent'
      },
      outline: {
        backgroundColor: 'transparent',
        color: config.textColor || '#007bff',
        border: `2px solid ${config.textColor || '#007bff'}`
      },
      text: {
        backgroundColor: 'transparent',
        color: config.textColor || '#007bff',
        border: '2px solid transparent'
      }
    };

    return {
      ...baseStyle,
      ...sizeStyles[config.size],
      ...variantStyles[config.variant]
    };
  };

  if (editMode) {
    return (
      <div className="button-widget-editor" style={{ padding: '16px', border: '1px solid #e0e0e0' }}>
        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="text" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Button Text:
          </label>
          <input
            id="text"
            type="text"
            value={config.text}
            onChange={(e) => handleConfigChange({ text: e.target.value })}
            style={{ width: '100%', padding: '8px' }}
            placeholder="Click Here"
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="url" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Link URL:
          </label>
          <input
            id="url"
            type="url"
            value={config.url}
            onChange={(e) => handleConfigChange({ url: e.target.value })}
            style={{ width: '100%', padding: '8px' }}
            placeholder="https://example.com"
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={config.openInNewTab}
              onChange={(e) => handleConfigChange({ openInNewTab: e.target.checked })}
            />
            <span>Open link in new tab</span>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label htmlFor="size" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Size:
            </label>
            <select
              id="size"
              value={config.size}
              onChange={(e) => handleConfigChange({ size: e.target.value as any })}
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>

          <div>
            <label htmlFor="variant" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Variant:
            </label>
            <select
              id="variant"
              value={config.variant}
              onChange={(e) => handleConfigChange({ variant: e.target.value as any })}
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="primary">Primary (Filled)</option>
              <option value="secondary">Secondary (Filled)</option>
              <option value="outline">Outline</option>
              <option value="text">Text Only</option>
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
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '100%', paddingTop: '24px' }}>
              <input
                type="checkbox"
                checked={config.fullWidth}
                onChange={(e) => handleConfigChange({ fullWidth: e.target.checked })}
              />
              <span>Full Width</span>
            </label>
          </div>

          <div>
            <label htmlFor="backgroundColor" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Background Color:
            </label>
            <input
              id="backgroundColor"
              type="color"
              value={config.backgroundColor || '#007bff'}
              onChange={(e) => handleConfigChange({ backgroundColor: e.target.value })}
              style={{ width: '100%', height: '36px' }}
            />
          </div>

          <div>
            <label htmlFor="textColor" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Text Color:
            </label>
            <input
              id="textColor"
              type="color"
              value={config.textColor || '#ffffff'}
              onChange={(e) => handleConfigChange({ textColor: e.target.value })}
              style={{ width: '100%', height: '36px' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="borderRadius" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Border Radius: {config.borderRadius}px
          </label>
          <input
            id="borderRadius"
            type="range"
            min="0"
            max="50"
            value={config.borderRadius}
            onChange={(e) => handleConfigChange({ borderRadius: parseInt(e.target.value) })}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label htmlFor="paddingVertical" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Vertical Padding: {config.padding.vertical}px
            </label>
            <input
              id="paddingVertical"
              type="range"
              min="0"
              max="50"
              value={config.padding.vertical}
              onChange={(e) => handleConfigChange({
                padding: { ...config.padding, vertical: parseInt(e.target.value) }
              })}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label htmlFor="paddingHorizontal" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Horizontal Padding: {config.padding.horizontal}px
            </label>
            <input
              id="paddingHorizontal"
              type="range"
              min="0"
              max="100"
              value={config.padding.horizontal}
              onChange={(e) => handleConfigChange({
                padding: { ...config.padding, horizontal: parseInt(e.target.value) }
              })}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Preview */}
        <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', fontSize: '12px', color: '#666' }}>Preview:</p>
          <div style={{ textAlign: config.alignment }}>
            <span style={getButtonStyle()}>{config.text}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="button-widget" style={{ textAlign: config.alignment }}>
      <a
        href={config.url}
        target={config.openInNewTab ? '_blank' : '_self'}
        rel={config.openInNewTab ? 'noopener noreferrer' : undefined}
        style={getButtonStyle()}
        role="button"
      >
        {config.text}
      </a>
    </div>
  );
}
