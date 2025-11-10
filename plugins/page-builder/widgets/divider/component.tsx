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

  const dividerWidth = `${config.width}%`;

  if (editMode) {
    return (
      <div className="divider-editor">
        <style>{`
          .divider-editor { padding: 16px; border: 1px solid #e0e0e0; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .label { display: block; margin-bottom: 4px; font-weight: bold; }
          .select, .input { width: 100%; padding: 8px; }
          .range { width: 100%; }
          .color { width: 100%; height: 36px; }
          .preview { margin-top: 16px; padding: 16px; background-color: #f5f5f5; border-radius: 4px; }
          .preview-title { margin: 0 0 8px 0; font-weight: bold; font-size: 12px; color: #666; }
          .align-left { text-align: left; }
          .align-center { text-align: center; }
          .align-right { text-align: right; }
          .divider-${widget.id} { margin-top: ${config.marginTop}px; margin-bottom: ${config.marginBottom}px; text-align: ${config.alignment}; }
          .divider-${widget.id} hr { width: ${dividerWidth}; border-style: ${config.style}; border-width: ${config.thickness}px 0 0 0; border-color: ${config.color}; margin: 0; display: inline-block; }
        `}</style>
        <div className="grid-2">
          <div>
            <label htmlFor="style" className="label">
              Line Style:
            </label>
            <select
              id="style"
              value={config.style}
              onChange={(e) => handleConfigChange({ style: e.target.value as any })}
              className="select"
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
              <option value="double">Double</option>
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
              className="select"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>

          <div>
            <label htmlFor="width" className="label">
              Width: {config.width}%
            </label>
            <input
              id="width"
              type="range"
              min="10"
              max="100"
              value={config.width}
              onChange={(e) => handleConfigChange({ width: parseInt(e.target.value) })}
              className="range"
            />
          </div>

          <div>
            <label htmlFor="thickness" className="label">
              Thickness: {config.thickness}px
            </label>
            <input
              id="thickness"
              type="range"
              min="1"
              max="20"
              value={config.thickness}
              onChange={(e) => handleConfigChange({ thickness: parseInt(e.target.value) })}
              className="range"
            />
          </div>

          <div>
            <label htmlFor="color" className="label">
              Color:
            </label>
            <input
              id="color"
              type="color"
              value={config.color}
              onChange={(e) => handleConfigChange({ color: e.target.value })}
              className="color"
            />
          </div>

          <div></div>

          <div>
            <label htmlFor="marginTop" className="label">
              Margin Top: {config.marginTop}px
            </label>
            <input
              id="marginTop"
              type="range"
              min="0"
              max="100"
              value={config.marginTop}
              onChange={(e) => handleConfigChange({ marginTop: parseInt(e.target.value) })}
              className="range"
            />
          </div>

          <div>
            <label htmlFor="marginBottom" className="label">
              Margin Bottom: {config.marginBottom}px
            </label>
            <input
              id="marginBottom"
              type="range"
              min="0"
              max="100"
              value={config.marginBottom}
              onChange={(e) => handleConfigChange({ marginBottom: parseInt(e.target.value) })}
              className="range"
            />
          </div>
        </div>

        {/* Preview */}
        <div className="preview">
          <p className="preview-title">Preview:</p>
          <div className={`divider-${widget.id}`}>
            <hr />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`divider-widget divider-${widget.id}`} role="separator">
      <style>{`
        .divider-${widget.id} { margin-top: ${config.marginTop}px; margin-bottom: ${config.marginBottom}px; text-align: ${config.alignment}; }
        .divider-${widget.id} hr { width: ${dividerWidth}; border-style: ${config.style}; border-width: ${config.thickness}px 0 0 0; border-color: ${config.color}; margin: 0; display: inline-block; }
      `}</style>
      <hr />
    </div>
  );
}
