import React from 'react';
import { WidgetInstance, WidgetConfig } from '../../src/types';
import { MapConfig } from './types';

interface MapWidgetProps {
  widget: WidgetInstance;
  editMode: boolean;
  onChange?: (config: WidgetConfig) => void;
}

export default function MapWidget({ widget, editMode, onChange }: MapWidgetProps) {
  const config = widget.config as MapConfig;

  const handleConfigChange = (updates: Partial<MapConfig>) => {
    if (onChange) {
      onChange({ ...config, ...updates });
    }
  };

  const getEmbedUrl = (): string => {
    // Using OpenStreetMap embed (free alternative to Google Maps)
    // For production, you'd use Google Maps API with an API key
    if (config.latitude && config.longitude) {
      return `https://www.openstreetmap.org/export/embed.html?bbox=${config.longitude - 0.01},${config.latitude - 0.01},${config.longitude + 0.01},${config.latitude + 0.01}&layer=mapnik&marker=${config.latitude},${config.longitude}`;
    }

    // Fallback to address-based URL
    const encodedAddress = encodeURIComponent(config.address);
    return `https://www.openstreetmap.org/export/embed.html?bbox=-122.52,37.70,-122.35,37.82&layer=mapnik`;
  };

  if (editMode) {
    return (
      <div className="map-widget-editor" style={{ padding: '16px', border: '1px solid #e0e0e0' }}>
        <h4 style={{ margin: '0 0 12px 0' }}>Map Settings</h4>

        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="address" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Address or Location:
          </label>
          <input
            id="address"
            type="text"
            value={config.address}
            onChange={(e) => handleConfigChange({ address: e.target.value })}
            style={{ width: '100%', padding: '8px' }}
            placeholder="123 Main St, City, State"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label htmlFor="latitude" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Latitude (optional):
            </label>
            <input
              id="latitude"
              type="number"
              step="0.000001"
              min="-90"
              max="90"
              value={config.latitude ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const text = e.target.value;
                if (text === '') {
                  handleConfigChange({ latitude: undefined });
                  return;
                }
                const num = parseFloat(text);
                if (Number.isFinite(num) && num >= -90 && num <= 90) {
                  handleConfigChange({ latitude: num });
                } else {
                  // Invalid input clears the value to avoid persisting NaN
                  handleConfigChange({ latitude: undefined });
                }
              }}
              style={{ width: '100%', padding: '8px' }}
              placeholder="37.7749"
            />
          </div>

          <div>
            <label htmlFor="longitude" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Longitude (optional):
            </label>
            <input
              id="longitude"
              type="number"
              step="0.000001"
              min="-180"
              max="180"
              value={config.longitude ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const text = e.target.value;
                if (text === '') {
                  handleConfigChange({ longitude: undefined });
                  return;
                }
                const num = parseFloat(text);
                if (Number.isFinite(num) && num >= -180 && num <= 180) {
                  handleConfigChange({ longitude: num });
                } else {
                  handleConfigChange({ longitude: undefined });
                }
              }}
              style={{ width: '100%', padding: '8px' }}
              placeholder="-122.4194"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label htmlFor="zoom" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Zoom Level: {config.zoom}
            </label>
            <input
              id="zoom"
              type="range"
              min="1"
              max="20"
              value={config.zoom}
              onChange={(e) => handleConfigChange({ zoom: parseInt(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label htmlFor="height" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Height: {config.height}px
            </label>
            <input
              id="height"
              type="range"
              min="200"
              max="1000"
              step="50"
              value={config.height}
              onChange={(e) => handleConfigChange({ height: parseInt(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label htmlFor="mapType" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Map Type:
            </label>
            <select
              id="mapType"
              value={config.mapType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                handleConfigChange({ mapType: e.target.value as MapConfig['mapType'] })
              }
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="roadmap">Roadmap</option>
              <option value="satellite">Satellite</option>
              <option value="hybrid">Hybrid</option>
              <option value="terrain">Terrain</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={config.showMarker}
              onChange={(e) => handleConfigChange({ showMarker: e.target.checked })}
            />
            <span>Show location marker</span>
          </label>
        </div>

        <div style={{ padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '4px', fontSize: '13px', color: '#666' }}>
          <strong>Note:</strong> This widget uses OpenStreetMap for the preview. In production, integrate with Google Maps API for full functionality and customization.
        </div>
      </div>
    );
  }

  return (
    <div className="map-widget" style={{ position: 'relative', height: `${config.height}px`, overflow: 'hidden' }}>
      <iframe
        src={getEmbedUrl()}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title={`Map of ${config.address}`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />

      {config.address && (
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          backgroundColor: 'white',
          padding: '8px 12px',
          borderRadius: '4px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          fontSize: '14px',
          maxWidth: '80%'
        }}>
          📍 {config.address}
        </div>
      )}
    </div>
  );
}
