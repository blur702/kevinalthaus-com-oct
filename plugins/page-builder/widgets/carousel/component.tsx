import React, { useState, useEffect } from 'react';
import { WidgetInstance, WidgetConfig } from '../../src/types';
import { CarouselConfig, CarouselSlide } from './types';

interface CarouselWidgetProps {
  widget: WidgetInstance;
  editMode: boolean;
  onChange?: (config: WidgetConfig) => void;
}

export default function CarouselWidget({ widget, editMode, onChange }: CarouselWidgetProps) {
  const config = widget.config as CarouselConfig;
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!editMode && config.autoPlay && config.slides.length > 1) {
      const timer = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % config.slides.length);
      }, config.interval);
      return () => clearInterval(timer);
    }
  }, [editMode, config.autoPlay, config.interval, config.slides.length]);

  const handleConfigChange = (updates: Partial<CarouselConfig>) => {
    if (onChange) {
      onChange({ ...config, ...updates });
    }
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + config.slides.length) % config.slides.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % config.slides.length);
  };

  const addSlide = () => {
    const newSlide: CarouselSlide = {
      id: Date.now().toString(),
      imageUrl: 'https://via.placeholder.com/800x400',
      alt: `Slide ${config.slides.length + 1}`,
      caption: ''
    };
    handleConfigChange({ slides: [...config.slides, newSlide] });
  };

  const removeSlide = (id: string) => {
    const newSlides = config.slides.filter(slide => slide.id !== id);
    handleConfigChange({ slides: newSlides });
    if (currentIndex >= newSlides.length) {
      setCurrentIndex(Math.max(0, newSlides.length - 1));
    }
  };

  const updateSlide = (id: string, updates: Partial<CarouselSlide>) => {
    handleConfigChange({
      slides: config.slides.map(slide => slide.id === id ? { ...slide, ...updates } : slide)
    });
  };

  if (editMode) {
    return (
      <div className="carousel-widget-editor">
        <style>{`
          .carousel-widget-editor { padding: 16px; border: 1px solid #e0e0e0; }
          .heading { margin: 0 0 12px 0; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
          .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 16px; }
          .label { display: block; margin-bottom: 4px; font-weight: bold; }
          .input { width: 100%; }
          .text { width: 100%; padding: 8px; margin-bottom: 8px; }
          .btn-remove { padding: 4px 8px; background-color: #dc3545; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
          .btn-remove:disabled { background-color: #ccc; cursor: not-allowed; }
          .item { margin-bottom: 12px; padding: 12px; background-color: #f9f9f9; border-radius: 4px; }
          .item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
          .slides-title { margin: 16px 0 8px 0; }
          .btn-add { width: 100%; padding: 8px; background-color: #007bff; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
          .checkbox-inline { display: flex; align-items: center; gap: 8px; }
        `}</style>
        <h4 className="heading">Carousel Settings</h4>

        <div className="grid-2">
          <div>
            <label htmlFor="height" className="label">
              Height: {config.height}px
            </label>
            <input
              id="height"
              type="range"
              min="200"
              max="1000"
              value={config.height}
              onChange={(e) => handleConfigChange({ height: parseInt(e.target.value) })}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="interval" className="label">
              Interval: {config.interval / 1000}s
            </label>
            <input
              id="interval"
              type="range"
              min="1000"
              max="30000"
              step="1000"
              value={config.interval}
              onChange={(e) => handleConfigChange({ interval: parseInt(e.target.value) })}
              className="input"
            />
          </div>
        </div>

        <div className="grid-3">
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={config.autoPlay}
              onChange={(e) => handleConfigChange({ autoPlay: e.target.checked })}
            />
            <span>Auto Play</span>
          </label>

          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={config.showDots}
              onChange={(e) => handleConfigChange({ showDots: e.target.checked })}
            />
            <span>Show Dots</span>
          </label>

          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={config.showArrows}
              onChange={(e) => handleConfigChange({ showArrows: e.target.checked })}
            />
            <span>Show Arrows</span>
          </label>
        </div>

        <h5 className="slides-title">Slides:</h5>

        {config.slides.map((slide, index) => (
          <div key={slide.id} className="item">
            <div className="item-header">
              <strong>Slide {index + 1}</strong>
              <button onClick={() => removeSlide(slide.id)} disabled={config.slides.length === 1} className="btn-remove">
                Remove
              </button>
            </div>

            <label htmlFor={`${slide.id}-image`} className="label">Image URL</label>
            <input id={`${slide.id}-image`}
              type="url"
              value={slide.imageUrl}
              onChange={(e) => updateSlide(slide.id, { imageUrl: e.target.value })}
              placeholder="Image URL"
              className="text"
            />

            <label htmlFor={`${slide.id}-alt`} className="label">Alt text (required)</label>
            <input id={`${slide.id}-alt`}
              type="text"
              value={slide.alt}
              onChange={(e) => updateSlide(slide.id, { alt: e.target.value })}
              placeholder="Alt text (required)"
              className="text"
            />

            <label htmlFor={`${slide.id}-caption`} className="label">Caption (optional)</label>
            <input id={`${slide.id}-caption`}
              type="text"
              value={slide.caption || ''}
              onChange={(e) => updateSlide(slide.id, { caption: e.target.value })}
              placeholder="Caption (optional)"
              className="text"
            />
          </div>
        ))}

        <button onClick={addSlide} className="btn-add">
          + Add Slide
        </button>
      </div>
    );
  }

  const currentSlide = config.slides[currentIndex];

  return (
    <div className={`carousel-widget carousel-${widget.id}`}>
      <style>{`
        .carousel-${widget.id} { position: relative; height: ${config.height}px; overflow: hidden; }
        .carousel-${widget.id} .stage { position: relative; width: 100%; height: 100%; }
        .carousel-${widget.id} img { width: 100%; height: 100%; object-fit: cover; }
        .carousel-${widget.id} .caption { position: absolute; bottom: 0; left: 0; right: 0; background-color: rgba(0,0,0,0.7); color: #fff; padding: 12px; text-align: center; }
        .carousel-${widget.id} .nav { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); background-color: rgba(0,0,0,0.5); color: #fff; border: none; border-radius: 50%; width: 40px; height: 40px; cursor: pointer; font-size: 20px; }
        .carousel-${widget.id} .nav.next { left: auto; right: 16px; }
        .carousel-${widget.id} .dots { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; }
        .carousel-${widget.id} .dot { width: 10px; height: 10px; border-radius: 50%; border: none; cursor: pointer; padding: 0; background-color: rgba(255,255,255,0.5); }
        .carousel-${widget.id} .dot.active { background-color: #fff; }
      `}</style>
      <div className="stage">
        <img
          src={currentSlide?.imageUrl}
          alt={currentSlide?.alt}
          
        />

        {currentSlide?.caption && (
          <div className="caption">
            {currentSlide.caption}
          </div>
        )}

        {config.showArrows && config.slides.length > 1 && (
          <>
            <button onClick={goToPrevious} className="nav prev" aria-label="Previous slide">
              ‹
            </button>

            <button onClick={goToNext} className="nav next" aria-label="Next slide">
              ›
            </button>
          </>
        )}

        {config.showDots && config.slides.length > 1 && (
          <div className="dots">
            {config.slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`dot ${index === currentIndex ? 'active' : ''}`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
