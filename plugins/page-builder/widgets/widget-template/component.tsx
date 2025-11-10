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
      <div className="widget-template-editor">
        <style>{`
          .widget-template-editor { padding: 16px; border: 1px dashed #ccc; }
          .section { margin-bottom: 12px; }
          .label { display: block; margin-bottom: 4px; font-weight: bold; }
          .textarea { width: 100%; min-height: 100px; padding: 8px; }
          .select { width: 100%; padding: 8px; }
          .checkbox-inline { display: flex; align-items: center; gap: 8px; }
          .color { width: 100%; padding: 4px; }
        `}</style>
        <h3>Widget Template - Edit Mode</h3>

        {/* Content input */}
        <div className="section">
          <label htmlFor="content" className="label">
            Content:
          </label>
          <textarea
            id="content"
            value={config.content || ''}
            onChange={(e) => handleConfigChange({ content: e.target.value })}
            className="textarea"
            placeholder="Enter widget content..."
            aria-label="Widget content"
          />
        </div>

        {/* Alignment selector */}
        <div className="section">
          <label htmlFor="alignment" className="label">
            Alignment:
          </label>
          <select
            id="alignment"
            value={config.alignment || 'left'}
            onChange={(e) => handleConfigChange({ alignment: e.target.value as 'left' | 'center' | 'right' })}
            className="select"
            aria-label="Text alignment"
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>

        {/* Border toggle */}
        <div className="section">
          <label className="checkbox-inline">
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
          <div className="section">
            <label htmlFor="borderColor" className="label">
              Border Color:
            </label>
            <input
              id="borderColor"
              type="color"
              value={config.borderColor || '#000000'}
              onChange={(e) => handleConfigChange({ borderColor: e.target.value })}
              className="color"
              aria-label="Border color"
            />
          </div>
        )}
      </div>
    );
  }

  // PREVIEW/RENDER MODE: Render clean, semantic HTML
  return (
    <div className={`widget-template wtemp-${widget.id}`} role="region" aria-label="Widget template content">
      <style>{`
        .wtemp-${widget.id} { text-align: ${config.alignment || 'left'}; ${config.showBorder ? `border: 2px solid ${config.borderColor || '#000000'}; padding: 16px;` : 'border: none; padding: 0;'} }
      `}</style>
      <div className="widget-template-content">
        {config.content || 'No content provided'}
      </div>
    </div>
  );
}
