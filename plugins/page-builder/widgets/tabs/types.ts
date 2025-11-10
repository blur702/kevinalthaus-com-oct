import { WidgetConfig } from '../../src/types';

export interface TabItem {
  id: string;
  title: string;
  content: string;
}

export interface TabsConfig extends WidgetConfig {
  tabs: TabItem[];
  activeTabBackgroundColor: string;
  inactiveTabBackgroundColor: string;
  tabTextColor: string;
}
