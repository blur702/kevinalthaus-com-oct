import React, { useState } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { WidgetInstance, WidgetConfig } from '../../src/types';
import { TabsConfig, TabItem } from './types';
import styles from './styles.module.css';

interface TabsWidgetProps {
  widget: WidgetInstance;
  editMode: boolean;
  onChange?: (config: WidgetConfig) => void;
}

let tabIdCounter = 0;
function generateTabId(): string {
  tabIdCounter += 1;
  return `tab-${tabIdCounter}`;
}

export default function TabsWidget({ widget, editMode, onChange }: TabsWidgetProps): JSX.Element {
  const config = widget.config as TabsConfig;
  const [activeTabId, setActiveTabId] = useState(config.tabs[0]?.id);

  const handleConfigChange = (updates: Partial<TabsConfig>): void => {
    if (onChange) {
      onChange({ ...config, ...updates });
    }
  };

  const addTab = (): void => {
    const newTab: TabItem = {
      id: generateTabId(),
      title: `Tab ${config.tabs.length + 1}`,
      content: ''
    };
    handleConfigChange({ tabs: [...config.tabs, newTab] });
  };

  const removeTab = (id: string): void => {
    const updatedTabs = config.tabs.filter(tab => tab.id !== id);
    if (activeTabId === id && updatedTabs.length > 0) {
      setActiveTabId(updatedTabs[0].id);
    }
    handleConfigChange({ tabs: updatedTabs });
  };

  const updateTab = (id: string, updates: Partial<TabItem>): void => {
    handleConfigChange({
      tabs: config.tabs.map(tab => tab.id === id ? { ...tab, ...updates } : tab)
    });
  };

  if (editMode) {
    return (
      <div className={styles.tabsWidgetEditor}>
        <h4 className={styles.tabsHeading}>Tabs Settings</h4>

        <div className={styles.tabsSettingsGrid}>
          <div>
            <label htmlFor={`${widget.id}-active-color`} className={styles.tabsLabel}>
              Active Tab Color:
            </label>
            <input
              id={`${widget.id}-active-color`}
              type="color"
              value={config.activeTabBackgroundColor}
              onChange={(e) => handleConfigChange({ activeTabBackgroundColor: e.target.value })}
              className={styles.tabsColor}
            />
          </div>

          <div>
            <label htmlFor={`${widget.id}-inactive-color`} className={styles.tabsLabel}>
              Inactive Tab Color:
            </label>
            <input
              id={`${widget.id}-inactive-color`}
              type="color"
              value={config.inactiveTabBackgroundColor}
              onChange={(e) => handleConfigChange({ inactiveTabBackgroundColor: e.target.value })}
              className={styles.tabsColor}
            />
          </div>

          <div>
            <label htmlFor={`${widget.id}-text-color`} className={styles.tabsLabel}>
              Tab Text Color:
            </label>
            <input
              id={`${widget.id}-text-color`}
              type="color"
              value={config.tabTextColor}
              onChange={(e) => handleConfigChange({ tabTextColor: e.target.value })}
              className={styles.tabsColor}
            />
          </div>
        </div>

        <h5 className={styles.tabsSectionTitle}>Tabs:</h5>

        {config.tabs.map((tab, index) => (
          <div key={tab.id} className={styles.tabItem}>
            <div className={styles.tabItemHeader}>
              <strong className={styles.tabItemTitle}>Tab {index + 1}</strong>
              <button
                onClick={() => removeTab(tab.id)}
                disabled={config.tabs.length === 1}
                className={styles.btnRemove}
              >
                Remove
              </button>
            </div>

            <label htmlFor={`${tab.id}-title`} className={styles.tabsLabel}>Tab Title</label>
            <input
              id={`${tab.id}-title`}
              type="text"
              value={tab.title}
              onChange={(e) => updateTab(tab.id, { title: e.target.value })}
              placeholder="Tab title"
              className={styles.textInput}
            />

            <label htmlFor={`${tab.id}-content`} className={styles.tabsLabel}>Tab Content</label>
            <textarea
              id={`${tab.id}-content`}
              value={tab.content}
              onChange={(e) => updateTab(tab.id, { content: e.target.value })}
              placeholder="Tab content"
              className={styles.textarea}
            />
          </div>
        ))}

        <button
          onClick={addTab}
          disabled={config.tabs.length >= 10}
          className={styles.btnAdd}
        >
          + Add Tab
        </button>
      </div>
    );
  }

  const activeTab = config.tabs.find(tab => tab.id === activeTabId) || config.tabs[0];

  return (
  <div className={styles.widget}>
      <div className={styles.tabsHeader} role="tablist">
        {config.tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={tab.id === activeTabId ? 'true' : 'false'}
            aria-controls={`tabpanel-${tab.id}`}
            onClick={() => setActiveTabId(tab.id)}
            tabIndex={tab.id === activeTabId ? 0 : -1}
            type="button"
            className={styles.tabButton}
            data-selected={tab.id === activeTabId ? 'true' : 'false'}
          >
            {tab.title}
          </button>
        ))}
      </div>

      <div
        id={`tabpanel-${activeTabId}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTabId}`}
        className={styles.tabPanel}
      >
        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(activeTab.content) }} />
      </div>
    </div>
  );
}
