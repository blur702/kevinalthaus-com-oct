import React from 'react';
import { WidgetInstance, WidgetConfig } from '../../src/types';
import { VideoConfig } from './types';

interface VideoWidgetProps {
  widget: WidgetInstance;
  editMode: boolean;
  onChange?: (config: WidgetConfig) => void;
}

export default function VideoWidget({ widget, editMode, onChange }: VideoWidgetProps) {
  const config = widget.config as VideoConfig;

  const handleConfigChange = (updates: Partial<VideoConfig>) => {
    if (onChange) {
      onChange({ ...config, ...updates });
    }
  };

  const getEmbedUrl = (): string => {
    if (config.source === 'youtube') {
      const videoId = extractYouTubeId(config.url);
      if (videoId) {
        const params = new URLSearchParams({
          autoplay: config.autoplay ? '1' : '0',
          controls: config.controls ? '1' : '0',
          mute: config.muted ? '1' : '0',
          loop: config.loop ? '1' : '0'
        });
        if (config.loop) {
          params.set('playlist', videoId);
        }
        return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
      }
    } else if (config.source === 'vimeo') {
      const videoId = extractVimeoId(config.url);
      if (videoId) {
        const params = new URLSearchParams({
          autoplay: config.autoplay ? '1' : '0',
          muted: config.muted ? '1' : '0',
          loop: config.loop ? '1' : '0'
        });
        return `https://player.vimeo.com/video/${videoId}?${params.toString()}`;
      }
    }
    return config.url;
  };

  const extractYouTubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {return match[1];}
    }
    return null;
  };

  const extractVimeoId = (url: string): string | null => {
    const match = url.match(/vimeo\.com\/(\d+)/);
    return match ? match[1] : null;
  };

  const getAspectRatioPadding = (): string => {
    const ratios: Record<string, string> = {
      '16:9': '56.25%',
      '4:3': '75%',
      '1:1': '100%',
      '21:9': '42.857%'
    };
    return ratios[config.aspectRatio] || '56.25%';
  };

  if (editMode) {
    return (
      <div className="video-widget-editor">
        <style>{`
          .video-widget-editor { padding: 16px; border: 1px solid #e0e0e0; }
          .section { margin-bottom: 12px; }
          .label { display: block; margin-bottom: 4px; font-weight: bold; }
          .input, .select { width: 100%; padding: 8px; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
          .grid-2-tight { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .checkbox-inline { display: flex; align-items: center; gap: 8px; }
        `}</style>
        <div className="section">
          <label htmlFor="url" className="label">
            Video URL:
          </label>
          <input
            id="url"
            type="url"
            value={config.url}
            onChange={(e) => handleConfigChange({ url: e.target.value })}
            className="input"
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </div>

        <div className="grid-2">
          <div>
            <label htmlFor="source" className="label">
              Video Source:
            </label>
            <select
              id="source"
              value={config.source}
              onChange={(e) => handleConfigChange({ source: e.target.value as any })}
              className="select"
            >
              <option value="youtube">YouTube</option>
              <option value="vimeo">Vimeo</option>
              <option value="direct">Direct URL (.mp4, .webm)</option>
            </select>
          </div>

          <div>
            <label htmlFor="aspectRatio" className="label">
              Aspect Ratio:
            </label>
            <select
              id="aspectRatio"
              value={config.aspectRatio}
              onChange={(e) => handleConfigChange({ aspectRatio: e.target.value as any })}
              className="select"
            >
              <option value="16:9">16:9 (Widescreen)</option>
              <option value="4:3">4:3 (Standard)</option>
              <option value="1:1">1:1 (Square)</option>
              <option value="21:9">21:9 (Ultrawide)</option>
            </select>
          </div>

          <div>
            <label htmlFor="width" className="label">
              Width: {config.width}%
            </label>
            <input
              id="width"
              type="range"
              min="20"
              max="100"
              value={config.width}
              onChange={(e) => handleConfigChange({ width: parseInt(e.target.value) })}
              className="select"
            />
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

        <div className="grid-2-tight">
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={config.autoplay}
              onChange={(e) => handleConfigChange({ autoplay: e.target.checked })}
            />
            <span>Autoplay</span>
          </label>

          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={config.controls}
              onChange={(e) => handleConfigChange({ controls: e.target.checked })}
            />
            <span>Show Controls</span>
          </label>

          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={config.muted}
              onChange={(e) => handleConfigChange({ muted: e.target.checked })}
            />
            <span>Muted</span>
          </label>

          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={config.loop}
              onChange={(e) => handleConfigChange({ loop: e.target.checked })}
            />
            <span>Loop</span>
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className={`video-widget video-${widget.id}`}>
      <style>{`
        .video-${widget.id} { width: ${config.width}%; margin: ${config.alignment === 'center' ? '0 auto' : config.alignment === 'right' ? '0 0 0 auto' : '0'}; }
        .video-${widget.id} .video-wrap { position: relative; padding-bottom: ${getAspectRatioPadding()}; height: 0; overflow: hidden; }
        .video-${widget.id} .video-el { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
      `}</style>
      <div className="video-wrap">
        {config.source === 'direct' ? (
          <video
            src={config.url}
            controls={config.controls}
            autoPlay={config.autoplay}
            muted={config.muted}
            loop={config.loop}
            className="video-el"
          >
            Your browser does not support the video tag.
          </video>
        ) : (
          <iframe
            src={getEmbedUrl()}
            className="video-el"
            frameBorder="0"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Embedded video"
          />
        )}
      </div>
    </div>
  );
}
