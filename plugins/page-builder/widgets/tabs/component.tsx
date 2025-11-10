import React, { useState } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { v4 as uuidv4 } from 'uuid';
import { WidgetInstance, WidgetConfig } from '../../src/types';
import { TabsConfig, TabItem } from './types';

interface TabsWidgetProps {
  widget: WidgetInstance;
  editMode: boolean;
  onChange?: (config: WidgetConfig) => void;
}

export default function TabsWidget({ widget, editMode, onChange }: TabsWidgetProps) {
  const config = widget.config as TabsConfig;
  const [activeTabId, setActiveTabId] = useState(config.tabs[0]?.id);

  const handleConfigChange = (updates: Partial<TabsConfig>) => {
    if (onChange) {
      onChange({ ...config, ...updates });
    }
  };

  const addTab = () => {
    const newTab: TabItem = {
      id: uuidv4(),
      title: `Tab ${config.tabs.length + 1}`,
      content: ''
    };
    handleConfigChange({ tabs: [...config.tabs, newTab] });
  };

  const removeTab = (id: string) => {
    const updatedTabs = config.tabs.filter(tab => tab.id !== id);
    if (activeTabId === id && updatedTabs.length > 0) {
      setActiveTabId(updatedTabs[0].id);
    }
    handleConfigChange({ tabs: updatedTabs });
  };

  const updateTab = (id: string, updates: Partial<TabItem>) => {
    handleConfigChange({
      tabs: config.tabs.map(tab => tab.id === id ? { ...tab, ...updates } : tab)
    });
  };

  if (editMode) {
    return (
      <div className="tabs-widget-editor">
        <style>{`
          .tabs-widget-editor { padding: 16px; border: 1px solid #e0e0e0; }
          .tabs-heading { margin: 0 0 12px 0; }
          .tabs-settings-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px; }
          .tabs-label { display: block; margin-bottom: 4px; font-weight: bold; font-size: 12px; }
          .tabs-color { width: 100%; height: 32px; }
          .tabs-section-title { margin: 16px 0 8px 0; }
          .tab-item { margin-bottom: 12px; padding: 12px; background-color: #f9f9f9; border-radius: 4px; }
          .tab-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
          .tab-item-title { font-size: 14px; }
          .btn-remove { padding: 4px 8px; background-color: #dc3545; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
          .btn-remove:disabled { background-color: #ccc; cursor: not-allowed; }
          .text-input { width: 100%; padding: 8px; margin-bottom: 8px; }
          .textarea { width: 100%; min-height: 80px; padding: 8px; }
          .btn-add { width: 100%; padding: 8px; background-color: #007bff; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
          .btn-add:disabled { background-color: #ccc; cursor: not-allowed; }
        `}</style>
        <h4 className="tabs-heading">Tabs Settings</h4>

        <div className="tabs-settings-grid">
          <div>
            <label htmlFor={`${widget.id}-active-color`} className="tabs-label">
              Active Tab Color:
            </label>
            <input
              id={`${widget.id}-active-color`}
              type="color"
              value={config.activeTabBackgroundColor}
              onChange={(e) => handleConfigChange({ activeTabBackgroundColor: e.target.value })}
              className="tabs-color"
            />
          </div>

          <div>
            <label htmlFor={`${widget.id}-inactive-color`} className="tabs-label">
              Inactive Tab Color:
            </label>
            <input
              id={`${widget.id}-inactive-color`}
              type="color"
              value={config.inactiveTabBackgroundColor}
              onChange={(e) => handleConfigChange({ inactiveTabBackgroundColor: e.target.value })}
              className="tabs-color"
            />
          </div>

          <div>
            <label htmlFor={`${widget.id}-text-color`} className="tabs-label">
              Tab Text Color:
            </label>
            <input
              id={`${widget.id}-text-color`}
              type="color"
              value={config.tabTextColor}
              onChange={(e) => handleConfigChange({ tabTextColor: e.target.value })}
              className="tabs-color"
            />
          </div>
        </div>

        <h5 className="tabs-section-title">Tabs:</h5>

        {config.tabs.map((tab, index) => (
          <div key={tab.id} className="tab-item">
            <div className="tab-item-header">
              <strong className="tab-item-title">Tab {index + 1}</strong>
              <button
                onClick={() => removeTab(tab.id)}
                disabled={config.tabs.length === 1}
                className="btn-remove"
              >
                Remove
              </button>
            </div>

            <label htmlFor={`${tab.id}-title`} className="tabs-label">Tab Title</label>
            <input
              id={`${tab.id}-title`}
              type="text"
              value={tab.title}
              onChange={(e) => updateTab(tab.id, { title: e.target.value })}
              placeholder="Tab title"
              className="text-input"
            />

            <label htmlFor={`${tab.id}-content`} className="tabs-label">Tab Content</label>
            <textarea
              id={`${tab.id}-content`}
              value={tab.content}
              onChange={(e) => updateTab(tab.id, { content: e.target.value })}
              placeholder="Tab content"
              className="textarea"
            />
          </div>
        ))}

        <button
          onClick={addTab}
          disabled={config.tabs.length >= 10}
          className="btn-add"
        >
          + Add Tab
        </button>
      </div>
    );
  }

  const activeTab = config.tabs.find(tab => tab.id === activeTabId) || config.tabs[0];

  return (
    <div className={`tabs-widget tabs-${widget.id}`}>
      <style>{`
        .tabs-${widget.id} .tabs-header { display: flex; border-bottom: 2px solid #e0e0e0; gap: 4px; }
        .tabs-${widget.id} .tab-btn { padding: 12px 24px; border: none; border-radius: 4px 4px 0 0; cursor: pointer; transition: all 0.2s; }
        .tabs-${widget.id} .tab-btn[aria-selected="true"] { background-color: ${config.activeTabBackgroundColor}; color: ${config.tabTextColor}; font-weight: bold; }
        .tabs-${widget.id} .tab-btn[aria-selected="false"] { background-color: ${config.inactiveTabBackgroundColor}; color: #333; font-weight: normal; }
        .tabs-${widget.id} .tab-panel { padding: 24px; background-color: #fff; border-left: 1px solid #e0e0e0; border-right: 1px solid #e0e0e0; border-bottom: 1px solid #e0e0e0; }
      `}</style>
      <div className="tabs-header" role="tablist">
        {config.tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={String(tab.id === activeTabId)}
            aria-controls={`tabpanel-${tab.id}`}
            onClick={() => setActiveTabId(tab.id)}
            tabIndex={tab.id === activeTabId ? 0 : -1}
            type="button"
            className="tab-btn"
          >
            {tab.title}
          </button>
        ))}
      </div>

      <div
        id={`tabpanel-${activeTabId}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTabId}`}
        className="tab-panel"
      >
        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(activeTab.content) }} />
      </div>
    </div>
  );
}
