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
      <div className="button-widget-editor">
        <style>{`
          .button-widget-editor { padding: 16px; border: 1px solid #e0e0e0; }
          .section { margin-bottom: 12px; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
          .label { display: block; margin-bottom: 4px; font-weight: bold; }
          .checkbox-inline { display: flex; align-items: center; gap: 8px; }
          .checkbox-inline.with-top { height: 100%; padding-top: 24px; }
          .input { width: 100%; padding: 8px; }
          .color { width: 100%; height: 36px; }
          .range { width: 100%; }
          .preview { margin-top: 16px; padding: 16px; background-color: #f5f5f5; border-radius: 4px; }
          .preview-title { margin: 0 0 8px 0; font-weight: bold; font-size: 12px; color: #666; }
          .align-left { text-align: left; }
          .align-center { text-align: center; }
          .align-right { text-align: right; }
          .btn { display: inline-block; text-decoration: none; font-weight: 600; cursor: pointer; border: 2px solid transparent; transition: all 0.3s ease; text-align: center; }
          .btn.size-small { font-size: 14px; }
          .btn.size-medium { font-size: 16px; }
          .btn.size-large { font-size: 18px; }
          .btn.full { width: 100%; }
          .btn-${widget.id} { padding: ${config.padding.vertical}px ${config.padding.horizontal}px; border-radius: ${config.borderRadius}px; }
          .btn-${widget.id}.variant-primary { background-color: ${config.backgroundColor || '#007bff'}; color: ${config.textColor || '#ffffff'}; border: 2px solid transparent; }
          .btn-${widget.id}.variant-secondary { background-color: ${config.backgroundColor || '#6c757d'}; color: ${config.textColor || '#ffffff'}; border: 2px solid transparent; }
          .btn-${widget.id}.variant-outline { background-color: transparent; color: ${config.textColor || '#007bff'}; border: 2px solid ${config.textColor || '#007bff'}; }
          .btn-${widget.id}.variant-text { background-color: transparent; color: ${config.textColor || '#007bff'}; border: 2px solid transparent; }
        `}</style>
        <div className="section">
          <label htmlFor="text" className="label">
            Button Text:
          </label>
          <input
            id="text"
            type="text"
            value={config.text}
            onChange={(e) => handleConfigChange({ text: e.target.value })}
            className="input"
            placeholder="Click Here"
          />
        </div>

        <div className="section">
          <label htmlFor="url" className="label">
            Link URL:
          </label>
          <input
            id="url"
            type="url"
            value={config.url}
            onChange={(e) => handleConfigChange({ url: e.target.value })}
            className="input"
            placeholder="https://example.com"
          />
        </div>

        <div className="section">
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={config.openInNewTab}
              onChange={(e) => handleConfigChange({ openInNewTab: e.target.checked })}
            />
            <span>Open link in new tab</span>
          </label>
        </div>

        <div className="grid-2">
          <div>
            <label htmlFor="size" className="label">
              Size:
            </label>
            <select
              id="size"
              value={config.size}
              onChange={(e) => handleConfigChange({ size: e.target.value as any })}
              className="input"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>

          <div>
            <label htmlFor="variant" className="label">
              Variant:
            </label>
            <select
              id="variant"
              value={config.variant}
              onChange={(e) => handleConfigChange({ variant: e.target.value as any })}
              className="input"
            >
              <option value="primary">Primary (Filled)</option>
              <option value="secondary">Secondary (Filled)</option>
              <option value="outline">Outline</option>
              <option value="text">Text Only</option>
            </select>
          </div>

          <div>
            <label htmlFor="alignment" className="label">
              Alignment:
            </label>
            <select
              id="alignment"
              value={config.alignment}
              onChange={(e) => handleConfigChange({ alignment: e.target.value as any })}
              className="input"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>

          <div>
            <label className="checkbox-inline with-top">
              <input
                type="checkbox"
                checked={config.fullWidth}
                onChange={(e) => handleConfigChange({ fullWidth: e.target.checked })}
              />
              <span>Full Width</span>
            </label>
          </div>

          <div>
            <label htmlFor="backgroundColor" className="label">
              Background Color:
            </label>
            <input
              id="backgroundColor"
              type="color"
              value={config.backgroundColor || '#007bff'}
              onChange={(e) => handleConfigChange({ backgroundColor: e.target.value })}
              className="color"
            />
          </div>

          <div>
            <label htmlFor="textColor" className="label">
              Text Color:
            </label>
            <input
              id="textColor"
              type="color"
              value={config.textColor || '#ffffff'}
              onChange={(e) => handleConfigChange({ textColor: e.target.value })}
              className="color"
            />
          </div>
        </div>

        <div className="section">
          <label htmlFor="borderRadius" className="label">
            Border Radius: {config.borderRadius}px
          </label>
          <input
            id="borderRadius"
            type="range"
            min="0"
            max="50"
            value={config.borderRadius}
            onChange={(e) => handleConfigChange({ borderRadius: parseInt(e.target.value) })}
            className="range"
          />
        </div>

        <div className="grid-2">
          <div>
            <label htmlFor="paddingVertical" className="label">
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
              className="range"
            />
          </div>

          <div>
            <label htmlFor="paddingHorizontal" className="label">
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
              className="range"
            />
          </div>
        </div>

        {/* Preview */}
        <div className="preview">
          <p className="preview-title">Preview:</p>
          <div className={`align-${config.alignment}`}>
            <span className={`btn btn-${widget.id} variant-${config.variant} size-${config.size} ${config.fullWidth ? 'full' : ''}`}>{config.text}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`button-widget align-${config.alignment}`}>
      <style>{`
        .align-left { text-align: left; }
        .align-center { text-align: center; }
        .align-right { text-align: right; }
        .btn { display: inline-block; text-decoration: none; font-weight: 600; cursor: pointer; border: 2px solid transparent; transition: all 0.3s ease; text-align: center; }
        .btn.size-small { font-size: 14px; }
        .btn.size-medium { font-size: 16px; }
        .btn.size-large { font-size: 18px; }
        .btn.full { width: 100%; }
        .btn-${widget.id} { padding: ${config.padding.vertical}px ${config.padding.horizontal}px; border-radius: ${config.borderRadius}px; }
        .btn-${widget.id}.variant-primary { background-color: ${config.backgroundColor || '#007bff'}; color: ${config.textColor || '#ffffff'}; border: 2px solid transparent; }
        .btn-${widget.id}.variant-secondary { background-color: ${config.backgroundColor || '#6c757d'}; color: ${config.textColor || '#ffffff'}; border: 2px solid transparent; }
        .btn-${widget.id}.variant-outline { background-color: transparent; color: ${config.textColor || '#007bff'}; border: 2px solid ${config.textColor || '#007bff'}; }
        .btn-${widget.id}.variant-text { background-color: transparent; color: ${config.textColor || '#007bff'}; border: 2px solid transparent; }
      `}</style>
      <a
        href={config.url}
        target={config.openInNewTab ? '_blank' : '_self'}
        rel={config.openInNewTab ? 'noopener noreferrer' : undefined}
        className={`btn btn-${widget.id} variant-${config.variant} size-${config.size} ${config.fullWidth ? 'full' : ''}`}
        role="button"
      >
        {config.text}
      </a>
    </div>
  );
}
