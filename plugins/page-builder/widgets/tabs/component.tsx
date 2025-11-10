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
      <div className="tabs-widget-editor" style={{ padding: '16px', border: '1px solid #e0e0e0' }}>
        <h4 style={{ margin: '0 0 12px 0' }}>Tabs Settings</h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '12px' }}>
              Active Tab Color:
            </label>
            <input
              type="color"
              value={config.activeTabBackgroundColor}
              onChange={(e) => handleConfigChange({ activeTabBackgroundColor: e.target.value })}
              style={{ width: '100%', height: '32px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '12px' }}>
              Inactive Tab Color:
            </label>
            <input
              type="color"
              value={config.inactiveTabBackgroundColor}
              onChange={(e) => handleConfigChange({ inactiveTabBackgroundColor: e.target.value })}
              style={{ width: '100%', height: '32px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '12px' }}>
              Tab Text Color:
            </label>
            <input
              type="color"
              value={config.tabTextColor}
              onChange={(e) => handleConfigChange({ tabTextColor: e.target.value })}
              style={{ width: '100%', height: '32px' }}
            />
          </div>
        </div>

        <h5 style={{ margin: '16px 0 8px 0' }}>Tabs:</h5>

        {config.tabs.map((tab, index) => (
          <div key={tab.id} style={{ marginBottom: '12px', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <strong style={{ fontSize: '14px' }}>Tab {index + 1}</strong>
              <button
                onClick={() => removeTab(tab.id)}
                disabled={config.tabs.length === 1}
                style={{
                  padding: '4px 8px',
                  backgroundColor: config.tabs.length === 1 ? '#ccc' : '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: config.tabs.length === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '12px'
                }}
              >
                Remove
              </button>
            </div>

            <input
              type="text"
              value={tab.title}
              onChange={(e) => updateTab(tab.id, { title: e.target.value })}
              placeholder="Tab title"
              style={{ width: '100%', padding: '8px', marginBottom: '8px' }}
            />

            <textarea
              value={tab.content}
              onChange={(e) => updateTab(tab.id, { content: e.target.value })}
              placeholder="Tab content"
              style={{ width: '100%', minHeight: '80px', padding: '8px' }}
            />
          </div>
        ))}

        <button
          onClick={addTab}
          disabled={config.tabs.length >= 10}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: config.tabs.length >= 10 ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: config.tabs.length >= 10 ? 'not-allowed' : 'pointer'
          }}
        >
          + Add Tab
        </button>
      </div>
    );
  }

  const activeTab = config.tabs.find(tab => tab.id === activeTabId) || config.tabs[0];

  return (
    <div className="tabs-widget" role="tablist">
      <div style={{ display: 'flex', borderBottom: '2px solid #e0e0e0', gap: '4px' }}>
        {config.tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={tab.id === activeTabId}
            aria-controls={`tabpanel-${tab.id}`}
            onClick={() => setActiveTabId(tab.id)}
            style={{
              padding: '12px 24px',
              backgroundColor: tab.id === activeTabId ? config.activeTabBackgroundColor : config.inactiveTabBackgroundColor,
              color: tab.id === activeTabId ? config.tabTextColor : '#333',
              border: 'none',
              borderRadius: '4px 4px 0 0',
              cursor: 'pointer',
              fontWeight: tab.id === activeTabId ? 'bold' : 'normal',
              transition: 'all 0.2s'
            }}
          >
            {tab.title}
          </button>
        ))}
      </div>

      <div
        id={`tabpanel-${activeTabId}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTabId}`}
        style={{
          padding: '24px',
          backgroundColor: 'white',
          borderLeft: '1px solid #e0e0e0',
          borderRight: '1px solid #e0e0e0',
          borderBottom: '1px solid #e0e0e0'
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(activeTab.content) }} />
      </div>
    </div>
  );
}
