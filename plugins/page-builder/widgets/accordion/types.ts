import { WidgetConfig } from '../../src/types';

export interface AccordionItem {
  id: string;
  title: string;
  content: string;
  isExpanded: boolean;
}

export interface AccordionConfig extends WidgetConfig {
  items: AccordionItem[];
  allowMultiple: boolean;
  borderColor: string;
  headerBackgroundColor: string;
  headerTextColor: string;
}
