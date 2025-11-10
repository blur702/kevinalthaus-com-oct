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
      <div className="map-widget-editor">
        <style>{`
          .map-widget-editor { padding: 16px; border: 1px solid #e0e0e0; }
          .heading { margin: 0 0 12px 0; }
          .section { margin-bottom: 12px; }
          .label { display: block; margin-bottom: 4px; font-weight: bold; }
          .input, .select { width: 100%; padding: 8px; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
          .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px; }
          .range { width: 100%; }
          .checkbox-inline { display: flex; align-items: center; gap: 8px; }
          .note { padding: 12px; background-color: #f9f9f9; border-radius: 4px; font-size: 13px; color: #666; }
        `}</style>
        <h4 className="heading">Map Settings</h4>

        <div className="section">
          <label htmlFor="address" className="label">
            Address or Location:
          </label>
          <input
            id="address"
            type="text"
            value={config.address}
            onChange={(e) => handleConfigChange({ address: e.target.value })}
            className="input"
            placeholder="123 Main St, City, State"
          />
        </div>

        <div className="grid-2">
          <div>
            <label htmlFor="latitude" className="label">
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
              className="input"
              placeholder="37.7749"
            />
          </div>

          <div>
            <label htmlFor="longitude" className="label">
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
              className="input"
              placeholder="-122.4194"
            />
          </div>
        </div>

        <div className="grid-3">
          <div>
            <label htmlFor="zoom" className="label">
              Zoom Level: {config.zoom}
            </label>
            <input
              id="zoom"
              type="range"
              min="1"
              max="20"
              value={config.zoom}
              onChange={(e) => handleConfigChange({ zoom: parseInt(e.target.value) })}
              className="range"
            />
          </div>

          <div>
            <label htmlFor="height" className="label">
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
              className="range"
            />
          </div>

          <div>
            <label htmlFor="mapType" className="label">
              Map Type:
            </label>
            <select
              id="mapType"
              value={config.mapType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                handleConfigChange({ mapType: e.target.value as MapConfig['mapType'] })
              }
              className="select"
            >
              <option value="roadmap">Roadmap</option>
              <option value="satellite">Satellite</option>
              <option value="hybrid">Hybrid</option>
              <option value="terrain">Terrain</option>
            </select>
          </div>
        </div>

        <div className="section">
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={config.showMarker}
              onChange={(e) => handleConfigChange({ showMarker: e.target.checked })}
            />
            <span>Show location marker</span>
          </label>
        </div>

        <div className="note">
          <strong>Note:</strong> This widget uses OpenStreetMap for the preview. In production, integrate with Google Maps API for full functionality and customization.
        </div>
      </div>
    );
  }

  return (
    <div className={`map-widget map-${widget.id}`}>
      <style>{`
        .map-${widget.id} { position: relative; height: ${config.height}px; overflow: hidden; }
        .map-${widget.id} iframe { width: 100%; height: 100%; border: none; }
        .map-${widget.id} .addr { position: absolute; bottom: 12px; left: 12px; background-color: #fff; padding: 8px 12px; border-radius: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); font-size: 14px; max-width: 80%; }
      `}</style>
      <iframe
        src={getEmbedUrl()}
        title={`Map of ${config.address}`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />

      {config.address && (
        <div className="addr">
          📍 {config.address}
        </div>
      )}
    </div>
  );
}
