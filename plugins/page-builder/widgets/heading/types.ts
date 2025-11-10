import { WidgetConfig } from '../../src/types';

export interface HeadingConfig extends WidgetConfig {
  text: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  textAlign: 'left' | 'center' | 'right';
  fontSize?: number;
  fontWeight: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  textColor?: string;
  marginTop: number;
  marginBottom: number;
}
