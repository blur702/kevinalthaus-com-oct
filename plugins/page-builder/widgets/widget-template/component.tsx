/**
 * Widget Template Component
 *
 * This is a reference template showing the standard widget component structure.
 * Copy this file and modify it to create your own widget.
 */

import React from 'react';
import { WidgetInstance, WidgetConfig } from '../../src/types';
import { WidgetTemplateConfig } from './types';

interface WidgetTemplateProps {
  widget: WidgetInstance;
  editMode: boolean;
  onChange?: (config: WidgetConfig) => void;
}

/**
 * Widget Template Component
 *
 * This component demonstrates the dual-mode rendering pattern:
 * - In edit mode: Render configuration controls that call onChange
 * - In preview/render mode: Render clean, semantic HTML output
 */
export default function WidgetTemplate({ widget, editMode, onChange }: WidgetTemplateProps) {
  // Type-safe config with proper typing
  const config = widget.config as WidgetTemplateConfig;

  // Handler for updating configuration
  const handleConfigChange = (updates: Partial<WidgetTemplateConfig>) => {
    if (onChange) {
      onChange({ ...config, ...updates });
    }
  };

  // EDIT MODE: Render configuration controls
  if (editMode) {
    return (
      <div className="widget-template-editor" style={{ padding: '16px', border: '1px dashed #ccc' }}>
        <h3>Widget Template - Edit Mode</h3>

        {/* Content input */}
        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="content" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Content:
          </label>
          <textarea
            id="content"
            value={config.content || ''}
            onChange={(e) => handleConfigChange({ content: e.target.value })}
            style={{ width: '100%', minHeight: '100px', padding: '8px' }}
            placeholder="Enter widget content..."
            aria-label="Widget content"
          />
        </div>

        {/* Alignment selector */}
        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="alignment" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Alignment:
          </label>
          <select
            id="alignment"
            value={config.alignment || 'left'}
            onChange={(e) => handleConfigChange({ alignment: e.target.value as 'left' | 'center' | 'right' })}
            style={{ width: '100%', padding: '8px' }}
            aria-label="Text alignment"
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>

        {/* Border toggle */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={config.showBorder || false}
              onChange={(e) => handleConfigChange({ showBorder: e.target.checked })}
              aria-label="Show border"
            />
            <span>Show border</span>
          </label>
        </div>

        {/* Border color (conditional) */}
        {config.showBorder && (
          <div style={{ marginBottom: '12px' }}>
            <label htmlFor="borderColor" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Border Color:
            </label>
            <input
              id="borderColor"
              type="color"
              value={config.borderColor || '#000000'}
              onChange={(e) => handleConfigChange({ borderColor: e.target.value })}
              style={{ width: '100%', padding: '4px' }}
              aria-label="Border color"
            />
          </div>
        )}
      </div>
    );
  }

  // PREVIEW/RENDER MODE: Render clean, semantic HTML
  return (
    <div
      className="widget-template"
      style={{
        textAlign: config.alignment || 'left',
        border: config.showBorder ? `2px solid ${config.borderColor || '#000000'}` : 'none',
        padding: config.showBorder ? '16px' : '0'
      }}
      role="region"
      aria-label="Widget template content"
    >
      <div className="widget-template-content">
        {config.content || 'No content provided'}
      </div>
    </div>
  );
}
