import { WidgetConfig } from '../../src/types';

export interface DividerConfig extends WidgetConfig {
  style: 'solid' | 'dashed' | 'dotted' | 'double';
  width: number;
  thickness: number;
  color: string;
  alignment: 'left' | 'center' | 'right';
  marginTop: number;
  marginBottom: number;
}
