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
      <div className="carousel-widget-editor" style={{ padding: '16px', border: '1px solid #e0e0e0' }}>
        <h4 style={{ margin: '0 0 12px 0' }}>Carousel Settings</h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label htmlFor="height" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Height: {config.height}px
            </label>
            <input
              id="height"
              type="range"
              min="200"
              max="1000"
              value={config.height}
              onChange={(e) => handleConfigChange({ height: parseInt(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label htmlFor="interval" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
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
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={config.autoPlay}
              onChange={(e) => handleConfigChange({ autoPlay: e.target.checked })}
            />
            <span>Auto Play</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={config.showDots}
              onChange={(e) => handleConfigChange({ showDots: e.target.checked })}
            />
            <span>Show Dots</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={config.showArrows}
              onChange={(e) => handleConfigChange({ showArrows: e.target.checked })}
            />
            <span>Show Arrows</span>
          </label>
        </div>

        <h5 style={{ margin: '16px 0 8px 0' }}>Slides:</h5>

        {config.slides.map((slide, index) => (
          <div key={slide.id} style={{ marginBottom: '12px', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <strong>Slide {index + 1}</strong>
              <button
                onClick={() => removeSlide(slide.id)}
                disabled={config.slides.length === 1}
                style={{
                  padding: '4px 8px',
                  backgroundColor: config.slides.length === 1 ? '#ccc' : '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: config.slides.length === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '12px'
                }}
              >
                Remove
              </button>
            </div>

            <input
              type="url"
              value={slide.imageUrl}
              onChange={(e) => updateSlide(slide.id, { imageUrl: e.target.value })}
              placeholder="Image URL"
              style={{ width: '100%', padding: '8px', marginBottom: '8px' }}
            />

            <input
              type="text"
              value={slide.alt}
              onChange={(e) => updateSlide(slide.id, { alt: e.target.value })}
              placeholder="Alt text (required)"
              style={{ width: '100%', padding: '8px', marginBottom: '8px' }}
            />

            <input
              type="text"
              value={slide.caption || ''}
              onChange={(e) => updateSlide(slide.id, { caption: e.target.value })}
              placeholder="Caption (optional)"
              style={{ width: '100%', padding: '8px' }}
            />
          </div>
        ))}

        <button
          onClick={addSlide}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          + Add Slide
        </button>
      </div>
    );
  }

  const currentSlide = config.slides[currentIndex];

  return (
    <div className="carousel-widget" style={{ position: 'relative', height: `${config.height}px`, overflow: 'hidden' }}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <img
          src={currentSlide?.imageUrl}
          alt={currentSlide?.alt}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />

        {currentSlide?.caption && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '12px',
            textAlign: 'center'
          }}>
            {currentSlide.caption}
          </div>
        )}

        {config.showArrows && config.slides.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                backgroundColor: 'rgba(0,0,0,0.5)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                cursor: 'pointer',
                fontSize: '20px'
              }}
              aria-label="Previous slide"
            >
              ‹
            </button>

            <button
              onClick={goToNext}
              style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                backgroundColor: 'rgba(0,0,0,0.5)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                cursor: 'pointer',
                fontSize: '20px'
              }}
              aria-label="Next slide"
            >
              ›
            </button>
          </>
        )}

        {config.showDots && config.slides.length > 1 && (
          <div style={{
            position: 'absolute',
            bottom: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '8px'
          }}>
            {config.slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: index === currentIndex ? 'white' : 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  padding: 0
                }}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
