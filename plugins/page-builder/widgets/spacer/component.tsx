import React from 'react';
import { WidgetInstance, WidgetConfig } from '../../src/types';
import { SpacerConfig } from './types';

interface SpacerProps {
  widget: WidgetInstance;
  editMode: boolean;
  onChange?: (config: WidgetConfig) => void;
}

export default function Spacer({ widget, editMode, onChange }: SpacerProps) {
  const config = widget.config as SpacerConfig;

  const handleConfigChange = (updates: Partial<SpacerConfig>) => {
    if (onChange) {
      onChange({ ...config, ...updates });
    }
  };

  if (editMode) {
    return (
      <div className="spacer-editor">
        <style>{`
          .spacer-editor { padding: 16px; border: 1px dashed #ccc; background-color: #f9f9f9; }
          .label { display: block; margin-bottom: 8px; font-weight: bold; }
          .range { width: 100%; }
          .hint { margin-top: 8px; font-size: 12px; color: #666; }
          .preview { margin-top: 16px; }
          .preview-box { background-color: #e3f2fd; border: 1px dashed #2196f3; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #1976d2; }
        `}</style>
        <div>
          <label htmlFor="height" className="label">
            Spacer Height: {config.height}px
          </label>
          <input
            id="height"
            type="range"
            min="1"
            max="500"
            value={config.height}
            onChange={(e) => handleConfigChange({ height: parseInt(e.target.value) })}
            className="range"
          />
          <div className="hint">
            Drag the slider to adjust vertical spacing
          </div>
        </div>

        {/* Visual preview */}
        <div className="preview">
          <style>{`.preview-box-${widget.id}{ height: ${Math.min(config.height, 200)}px; }`}</style>
          <div className={`preview-box preview-box-${widget.id}`}>
            {config.height}px {config.height > 200 && `(preview capped at 200px)`}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`spacer-widget spacer-${widget.id}`} role="presentation" aria-hidden="true">
      <style>{`.spacer-${widget.id}{ height: ${config.height}px; }`}</style>
    </div>
  );
}
