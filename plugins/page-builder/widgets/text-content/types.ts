import { WidgetConfig } from '../../src/types';

export interface TextContentConfig extends WidgetConfig {
  content: string;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  fontSize: number;
  lineHeight: number;
  textColor?: string;
  backgroundColor?: string;
  padding: number;
}
