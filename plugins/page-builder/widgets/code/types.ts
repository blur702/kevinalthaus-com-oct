import { WidgetConfig } from '../../src/types';

export interface CodeConfig extends WidgetConfig {
  code: string;
  language: string;
  showLineNumbers: boolean;
  theme: 'light' | 'dark';
  fontSize: number;
}
