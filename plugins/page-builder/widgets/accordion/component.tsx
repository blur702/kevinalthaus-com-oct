import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { WidgetInstance, WidgetConfig } from '../../src/types';
import { AccordionConfig, AccordionItem } from './types';

interface AccordionWidgetProps {
  widget: WidgetInstance;
  editMode: boolean;
  onChange?: (config: WidgetConfig) => void;
}

export default function AccordionWidget({ widget, editMode, onChange }: AccordionWidgetProps) {
  const config = widget.config as AccordionConfig;
  const [expandedIds, setExpandedIds] = useState<string[]>(
    config.items.filter(item => item.isExpanded).map(item => item.id)
  );

  const handleConfigChange = (updates: Partial<AccordionConfig>) => {
    if (onChange) {
      onChange({ ...config, ...updates });
    }
  };

  const toggleItem = (id: string) => {
    setExpandedIds(prev => {
      if (config.allowMultiple) {
        return prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id];
      } else {
        return prev.includes(id) ? [] : [id];
      }
    });
  };

  const addItem = () => {
    const newItem: AccordionItem = {
      id: Date.now().toString(),
      title: `Section ${config.items.length + 1}`,
      content: '',
      isExpanded: false
    };
    handleConfigChange({ items: [...config.items, newItem] });
  };

  const removeItem = (id: string) => {
    handleConfigChange({ items: config.items.filter(item => item.id !== id) });
  };

  const updateItem = (id: string, updates: Partial<AccordionItem>) => {
    handleConfigChange({
      items: config.items.map(item => item.id === id ? { ...item, ...updates } : item)
    });
  };

  if (editMode) {
    return (
      <div className="accordion-widget-editor" style={{ padding: '16px', border: '1px solid #e0e0e0' }}>
        <h4 style={{ margin: '0 0 12px 0' }}>Accordion Settings</h4>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={config.allowMultiple}
              onChange={(e) => handleConfigChange({ allowMultiple: e.target.checked })}
            />
            <span>Allow multiple panels open</span>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '12px' }}>
              Border Color:
            </label>
            <input
              type="color"
              value={config.borderColor}
              onChange={(e) => handleConfigChange({ borderColor: e.target.value })}
              style={{ width: '100%', height: '32px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '12px' }}>
              Header Background:
            </label>
            <input
              type="color"
              value={config.headerBackgroundColor}
              onChange={(e) => handleConfigChange({ headerBackgroundColor: e.target.value })}
              style={{ width: '100%', height: '32px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '12px' }}>
              Header Text:
            </label>
            <input
              type="color"
              value={config.headerTextColor}
              onChange={(e) => handleConfigChange({ headerTextColor: e.target.value })}
              style={{ width: '100%', height: '32px' }}
            />
          </div>
        </div>

        <h5 style={{ margin: '16px 0 8px 0' }}>Accordion Items:</h5>

        {config.items.map((item, index) => (
          <div key={item.id} style={{ marginBottom: '12px', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <strong style={{ fontSize: '14px' }}>Item {index + 1}</strong>
              <button
                onClick={() => removeItem(item.id)}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Remove
              </button>
            </div>

            <input
              type="text"
              value={item.title}
              onChange={(e) => updateItem(item.id, { title: e.target.value })}
              placeholder="Panel title"
              style={{ width: '100%', padding: '8px', marginBottom: '8px' }}
            />

            <textarea
              value={item.content}
              onChange={(e) => updateItem(item.id, { content: e.target.value })}
              placeholder="Panel content"
              style={{ width: '100%', minHeight: '80px', padding: '8px' }}
            />
          </div>
        ))}

        <button
          onClick={addItem}
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
          + Add Item
        </button>
      </div>
    );
  }

  return (
    <div className="accordion-widget" role="region" aria-label="Accordion content">
      {config.items.map((item) => {
        const isExpanded = expandedIds.includes(item.id);

        return (
          <div
            key={item.id}
            style={{
              border: `1px solid ${config.borderColor}`,
              marginBottom: '4px',
              borderRadius: '4px',
              overflow: 'hidden'
            }}
          >
            <button
              onClick={() => toggleItem(item.id)}
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: config.headerBackgroundColor,
                color: config.headerTextColor,
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontWeight: '600',
                fontSize: '16px'
              }}
              aria-expanded={isExpanded}
              aria-controls={`accordion-content-${item.id}`}
            >
              <span>{item.title}</span>
              <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                ▼
              </span>
            </button>

            {isExpanded && (
              <div
                id={`accordion-content-${item.id}`}
                style={{
                  padding: '16px',
                  backgroundColor: 'white',
                  borderTop: `1px solid ${config.borderColor}`
                }}
                role="region"
              >
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(String(item.content)) }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
