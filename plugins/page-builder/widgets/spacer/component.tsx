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
      <div className="spacer-editor" style={{ padding: '16px', border: '1px dashed #ccc', backgroundColor: '#f9f9f9' }}>
        <div>
          <label htmlFor="height" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Spacer Height: {config.height}px
          </label>
          <input
            id="height"
            type="range"
            min="1"
            max="500"
            value={config.height}
            onChange={(e) => handleConfigChange({ height: parseInt(e.target.value) })}
            style={{ width: '100%' }}
          />
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
            Drag the slider to adjust vertical spacing
          </div>
        </div>

        {/* Visual preview */}
        <div style={{ marginTop: '16px' }}>
          <div
            style={{
              height: `${Math.min(config.height, 200)}px`,
              backgroundColor: '#e3f2fd',
              border: '1px dashed #2196f3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: '#1976d2'
            }}
          >
            {config.height}px {config.height > 200 && `(preview capped at 200px)`}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="spacer-widget"
      style={{ height: `${config.height}px` }}
      role="presentation"
      aria-hidden="true"
    />
  );
}
