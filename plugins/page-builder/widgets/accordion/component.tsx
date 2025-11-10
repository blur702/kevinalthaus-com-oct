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
      <div className="accordion-widget-editor">
        <style>{`
          .accordion-widget-editor { padding: 16px; border: 1px solid #e0e0e0; }
          .heading { margin: 0 0 12px 0; }
          .section { margin-bottom: 12px; }
          .checkbox-inline { display: flex; align-items: center; gap: 8px; }
          .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px; }
          .label { display: block; margin-bottom: 4px; font-weight: bold; font-size: 12px; }
          .color { width: 100%; height: 32px; }
          .items-title { margin: 16px 0 8px 0; }
          .item { margin-bottom: 12px; padding: 12px; background-color: #f9f9f9; border-radius: 4px; }
          .item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
          .item-title { font-size: 14px; }
          .btn-remove { padding: 4px 8px; background-color: #dc3545; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
          .text { width: 100%; padding: 8px; margin-bottom: 8px; }
          .textarea { width: 100%; min-height: 80px; padding: 8px; }
          .btn-add { width: 100%; padding: 8px; background-color: #007bff; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
        `}</style>
        <h4 className="heading">Accordion Settings</h4>

        <div className="section">
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={config.allowMultiple}
              onChange={(e) => handleConfigChange({ allowMultiple: e.target.checked })}
            />
            <span>Allow multiple panels open</span>
          </label>
        </div>

        <div className="grid-3">
          <div>
            <label className="label" htmlFor={`${widget.id}-border-color`}>
              Border Color:
            </label>
            <input
              id={`${widget.id}-border-color`}
              type="color"
              value={config.borderColor}
              onChange={(e) => handleConfigChange({ borderColor: e.target.value })}
              className="color"
            />
          </div>

          <div>
            <label className="label" htmlFor={`${widget.id}-header-bg`}>
              Header Background:
            </label>
            <input
              id={`${widget.id}-header-bg`}
              type="color"
              value={config.headerBackgroundColor}
              onChange={(e) => handleConfigChange({ headerBackgroundColor: e.target.value })}
              className="color"
            />
          </div>

          <div>
            <label className="label" htmlFor={`${widget.id}-header-text`}>
              Header Text:
            </label>
            <input
              id={`${widget.id}-header-text`}
              type="color"
              value={config.headerTextColor}
              onChange={(e) => handleConfigChange({ headerTextColor: e.target.value })}
              className="color"
            />
          </div>
        </div>

        <h5 className="items-title">Accordion Items:</h5>

        {config.items.map((item, index) => (
          <div key={item.id} className="item">
            <div className="item-header">
              <strong className="item-title">Item {index + 1}</strong>
              <button
                onClick={() => removeItem(item.id)}
                className="btn-remove"
              >
                Remove
              </button>
            </div>

            <label className="label" htmlFor={`${item.id}-title`}>Panel Title</label>
            <input
              id={`${item.id}-title`}
              type="text"
              value={item.title}
              onChange={(e) => updateItem(item.id, { title: e.target.value })}
              placeholder="Panel title"
              className="text"
            />

            <label className="label" htmlFor={`${item.id}-content`}>Panel Content</label>
            <textarea
              id={`${item.id}-content`}
              value={item.content}
              onChange={(e) => updateItem(item.id, { content: e.target.value })}
              placeholder="Panel content"
              className="textarea"
            />
          </div>
        ))}

        <button
          onClick={addItem}
          className="btn-add"
        >
          + Add Item
        </button>
      </div>
    );
  }

  return (
    <div className={`accordion-widget accordion-${widget.id}`} role="region" aria-label="Accordion content">
      <style>{`
        .accordion-${widget.id} .item-wrap { border: 1px solid ${config.borderColor}; margin-bottom: 4px; border-radius: 4px; overflow: hidden; }
        .accordion-${widget.id} .item-header-btn { width: 100%; padding: 12px 16px; background-color: ${config.headerBackgroundColor}; color: ${config.headerTextColor}; border: none; text-align: left; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-weight: 600; font-size: 16px; }
        .accordion-${widget.id} .chevron { transition: transform 0.2s; transform: rotate(0); }
        .accordion-${widget.id} .item-header-btn[aria-expanded="true"] .chevron { transform: rotate(180deg); }
        .accordion-${widget.id} .item-content { padding: 16px; background-color: #fff; border-top: 1px solid ${config.borderColor}; }
      `}</style>
      {config.items.map((item) => {
        const isExpanded = expandedIds.includes(item.id);

        return (
          <div
            key={item.id}
            className="item-wrap"
          >
            <button
              onClick={() => toggleItem(item.id)}
              className="item-header-btn"
              aria-expanded={isExpanded}
              aria-controls={`accordion-content-${item.id}`}
            >
              <span>{item.title}</span>
              <span className="chevron">
                ▼
              </span>
            </button>

            {isExpanded && (
              <div
                id={`accordion-content-${item.id}`}
                className="item-content"
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
