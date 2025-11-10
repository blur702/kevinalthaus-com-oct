import React from 'react';
import { WidgetInstance, WidgetConfig } from '../../src/types';
import { ImageConfig } from './types';

interface ImageWidgetProps {
  widget: WidgetInstance;
  editMode: boolean;
  onChange?: (config: WidgetConfig) => void;
}

export default function ImageWidget({ widget, editMode, onChange }: ImageWidgetProps) {
  const config = widget.config as ImageConfig;

  const handleConfigChange = (updates: Partial<ImageConfig>) => {
    if (onChange) {
      onChange({ ...config, ...updates });
    }
  };

  if (editMode) {
    return (
      <div className="image-widget-editor">
        <style>{`
          .image-widget-editor { padding: 16px; border: 1px solid #e0e0e0; }
          .section { margin-bottom: 12px; }
          .label { display: block; margin-bottom: 4px; font-weight: bold; }
          .input, .select { width: 100%; padding: 8px; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
          .preview { margin-top: 16px; padding: 16px; background-color: #f5f5f5; border-radius: 4px; }
          .preview-title { margin: 0 0 8px 0; font-weight: bold; font-size: 12px; color: #666; }
          .align-left { text-align: left; }
          .align-center { text-align: center; }
          .align-right { text-align: right; }
          .img-${widget.id} { max-width: 100%; width: ${config.width}px; height: ${config.height ? `${config.height}px` : 'auto'}; object-fit: ${config.objectFit}; border-radius: ${config.borderRadius}px; display: block; }
        `}</style>
        <div className="section">
          <label htmlFor="src" className="label">
            Image URL:
          </label>
          <input
            id="src"
            type="url"
            value={config.src}
            onChange={(e) => handleConfigChange({ src: e.target.value })}
            className="input"
            placeholder="https://example.com/image.jpg"
          />
        </div>

        <div className="section">
          <label htmlFor="alt" className="label">
            Alt Text (Required for Accessibility):
          </label>
          <input
            id="alt"
            type="text"
            value={config.alt}
            onChange={(e) => handleConfigChange({ alt: e.target.value })}
            className="input"
            placeholder="Describe the image for screen readers"
            required
          />
        </div>

        <div className="section">
          <label htmlFor="caption" className="label">
            Caption (Optional):
          </label>
          <input
            id="caption"
            type="text"
            value={config.caption || ''}
            onChange={(e) => handleConfigChange({ caption: e.target.value })}
            className="input"
            placeholder="Image caption"
          />
        </div>

        <div className="grid-2">
          <div>
            <label htmlFor="width" className="label">
              Width (px):
            </label>
            <input
              id="width"
              type="number"
              min="50"
              max="2000"
              value={config.width}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!Number.isNaN(value)) {
                  handleConfigChange({ width: value });
                }
              }}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="height" className="label">
              Height (px, optional):
            </label>
            <input
              id="height"
              type="number"
              min="50"
              max="2000"
              value={config.height || ''}
              onChange={(e) => handleConfigChange({ height: e.target.value ? parseInt(e.target.value) : undefined })}
              className="input"
              placeholder="Auto"
            />
          </div>

          <div>
            <label htmlFor="objectFit" className="label">
              Object Fit:
            </label>
            <select
              id="objectFit"
              value={config.objectFit}
              onChange={(e) => handleConfigChange({ objectFit: e.target.value as any })}
              className="select"
            >
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
              <option value="fill">Fill</option>
              <option value="none">None</option>
              <option value="scale-down">Scale Down</option>
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
        </div>

        <div className="section">
          <label htmlFor="borderRadius" className="label">
            Border Radius: {config.borderRadius}px
          </label>
          <input
            id="borderRadius"
            type="range"
            min="0"
            max="100"
            value={config.borderRadius}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              handleConfigChange({ borderRadius: Number.isNaN(value) ? 0 : value });
            }}
            className="select"
          />
        </div>

        <div className="section">
          <label htmlFor="linkUrl" className="label">
            Link URL (Optional):
          </label>
          <input
            id="linkUrl"
            type="url"
            value={config.linkUrl || ''}
            onChange={(e) => handleConfigChange({ linkUrl: e.target.value })}
            className="input"
            placeholder="https://example.com"
          />
        </div>

        {config.linkUrl && (
          <div>
            <style>{`.checkbox-inline { display: flex; align-items: center; gap: 8px; }`}</style>
            <label className="label checkbox-inline">
              <input
                type="checkbox"
                checked={config.openInNewTab}
                onChange={(e) => handleConfigChange({ openInNewTab: e.target.checked })}
              />
              <span>Open link in new tab</span>
            </label>
          </div>
        )}

        {/* Preview */}
        <div className="preview">
          <p className="preview-title">Preview:</p>
          <div className={`align-${config.alignment}`}>
            <img className={`img-${widget.id}`} src={config.src} alt={config.alt} />
          </div>
        </div>
      </div>
    );
  }

  const imageElement = (
    <>
      <style>{`
        .img-${widget.id} { max-width: 100%; width: ${config.width}px; height: ${config.height ? `${config.height}px` : 'auto'}; object-fit: ${config.objectFit}; border-radius: ${config.borderRadius}px; display: block; }
      `}</style>
      <img className={`img-${widget.id}`} src={config.src} alt={config.alt} />
    </>
  );

  return (
    <figure className={`image-widget align-${config.alignment}`}>
      <style>{`
        .image-widget { margin: 0; }
        .align-left { text-align: left; }
        .align-center { text-align: center; }
        .align-right { text-align: right; }
        .inline-block { display: inline-block; }
        .img-caption { margin-top: 8px; font-size: 14px; color: #666; font-style: italic; }
      `}</style>
      {config.linkUrl ? (
        <a
          href={config.linkUrl}
          target={config.openInNewTab ? '_blank' : '_self'}
          rel={config.openInNewTab ? 'noopener noreferrer' : undefined}
          className="inline-block"
        >
          {imageElement}
        </a>
      ) : (
        imageElement
      )}
      {config.caption && (
        <figcaption className="img-caption">
          {config.caption}
        </figcaption>
      )}
    </figure>
  );
}
