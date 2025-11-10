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

  const fontSize = `${config.fontSize}px`;

  if (editMode) {
    return (
      <div className="text-content-editor">
        <style>{`
          .text-content-editor { padding: 16px; border: 1px solid #e0e0e0; }
          .section { margin-bottom: 12px; }
          .label { display: block; margin-bottom: 8px; font-weight: bold; }
          .textarea { width: 100%; min-height: 150px; padding: 8px; font-family: inherit; }
          .hint { display: block; margin-top: 4px; color: #666; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .select { width: 100%; padding: 6px; }
          .range { width: 100%; }
          .color { width: 100%; height: 36px; }
        `}</style>
        <div className="section">
          <label className="label">
            Text Content:
          </label>
          <textarea
            value={config.content}
            onChange={(e) => handleConfigChange({ content: e.target.value })}
            className="textarea"
            placeholder="Enter rich text content (HTML supported)..."
            aria-label="Text content"
          />
          <small className="hint">
            HTML formatting is supported (e.g., &lt;p&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;ul&gt;, &lt;ol&gt;)
          </small>
        </div>

        <div className="grid-2">
          <div>
            <label htmlFor="textAlign" className="label">
              Text Alignment:
            </label>
            <select
              id="textAlign"
              value={config.textAlign}
              onChange={(e) => handleConfigChange({ textAlign: e.target.value as any })}
              className="select"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
              <option value="justify">Justify</option>
            </select>
          </div>

          <div>
            <label htmlFor="fontSize" className="label">
              Font Size: {config.fontSize}px
            </label>
            <input
              id="fontSize"
              type="range"
              min="8"
              max="72"
              value={config.fontSize}
              onChange={(e) => handleConfigChange({ fontSize: parseInt(e.target.value) })}
              className="range"
            />
          </div>

          <div>
            <label htmlFor="lineHeight" className="label">
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
              className="range"
            />
          </div>

          <div>
            <label htmlFor="padding" className="label">
              Padding: {config.padding}px
            </label>
            <input
              id="padding"
              type="range"
              min="0"
              max="100"
              value={config.padding}
              onChange={(e) => handleConfigChange({ padding: parseInt(e.target.value) })}
              className="range"
            />
          </div>

          <div>
            <label htmlFor="textColor" className="label">
              Text Color:
            </label>
            <input
              id="textColor"
              type="color"
              value={config.textColor || '#000000'}
              onChange={(e) => handleConfigChange({ textColor: e.target.value })}
              className="color"
            />
          </div>

          <div>
            <label htmlFor="backgroundColor" className="label">
              Background Color:
            </label>
            <input
              id="backgroundColor"
              type="color"
              value={config.backgroundColor || '#ffffff'}
              onChange={(e) => handleConfigChange({ backgroundColor: e.target.value })}
              className="color"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`text-content text-${widget.id}`}
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(config.content) }}
      role="article"
      aria-label="Text content"
    >
      <style>{`
        .text-${widget.id} {
          text-align: ${config.textAlign};
          font-size: ${fontSize};
          line-height: ${config.lineHeight};
          color: ${config.textColor};
          background-color: ${config.backgroundColor};
          padding: ${config.padding}px;
        }
      `}</style>
    </div>
  );
}
