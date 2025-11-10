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
      <div className="image-widget-editor" style={{ padding: '16px', border: '1px solid #e0e0e0' }}>
        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="src" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Image URL:
          </label>
          <input
            id="src"
            type="url"
            value={config.src}
            onChange={(e) => handleConfigChange({ src: e.target.value })}
            style={{ width: '100%', padding: '8px' }}
            placeholder="https://example.com/image.jpg"
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="alt" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Alt Text (Required for Accessibility):
          </label>
          <input
            id="alt"
            type="text"
            value={config.alt}
            onChange={(e) => handleConfigChange({ alt: e.target.value })}
            style={{ width: '100%', padding: '8px' }}
            placeholder="Describe the image for screen readers"
            required
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="caption" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Caption (Optional):
          </label>
          <input
            id="caption"
            type="text"
            value={config.caption || ''}
            onChange={(e) => handleConfigChange({ caption: e.target.value })}
            style={{ width: '100%', padding: '8px' }}
            placeholder="Image caption"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label htmlFor="width" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
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
              style={{ width: '100%', padding: '8px' }}
            />
          </div>

          <div>
            <label htmlFor="height" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Height (px, optional):
            </label>
            <input
              id="height"
              type="number"
              min="50"
              max="2000"
              value={config.height || ''}
              onChange={(e) => handleConfigChange({ height: e.target.value ? parseInt(e.target.value) : undefined })}
              style={{ width: '100%', padding: '8px' }}
              placeholder="Auto"
            />
          </div>

          <div>
            <label htmlFor="objectFit" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Object Fit:
            </label>
            <select
              id="objectFit"
              value={config.objectFit}
              onChange={(e) => handleConfigChange({ objectFit: e.target.value as any })}
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
              <option value="fill">Fill</option>
              <option value="none">None</option>
              <option value="scale-down">Scale Down</option>
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
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="borderRadius" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
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
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="linkUrl" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Link URL (Optional):
          </label>
          <input
            id="linkUrl"
            type="url"
            value={config.linkUrl || ''}
            onChange={(e) => handleConfigChange({ linkUrl: e.target.value })}
            style={{ width: '100%', padding: '8px' }}
            placeholder="https://example.com"
          />
        </div>

        {config.linkUrl && (
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
        <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', fontSize: '12px', color: '#666' }}>Preview:</p>
          <div style={{ textAlign: config.alignment }}>
            <img
              src={config.src}
              alt={config.alt}
              style={{
                maxWidth: '100%',
                width: `${config.width}px`,
                height: config.height ? `${config.height}px` : 'auto',
                objectFit: config.objectFit,
                borderRadius: `${config.borderRadius}px`
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  const imageElement = (
    <img
      src={config.src}
      alt={config.alt}
      style={{
        maxWidth: '100%',
        width: `${config.width}px`,
        height: config.height ? `${config.height}px` : 'auto',
        objectFit: config.objectFit,
        borderRadius: `${config.borderRadius}px`,
        display: 'block'
      }}
    />
  );

  return (
    <figure
      className="image-widget"
      style={{
        margin: 0,
        textAlign: config.alignment
      }}
    >
      {config.linkUrl ? (
        <a
          href={config.linkUrl}
          target={config.openInNewTab ? '_blank' : '_self'}
          rel={config.openInNewTab ? 'noopener noreferrer' : undefined}
          style={{ display: 'inline-block' }}
        >
          {imageElement}
        </a>
      ) : (
        imageElement
      )}
      {config.caption && (
        <figcaption style={{ marginTop: '8px', fontSize: '14px', color: '#666', fontStyle: 'italic' }}>
          {config.caption}
        </figcaption>
      )}
    </figure>
  );
}
