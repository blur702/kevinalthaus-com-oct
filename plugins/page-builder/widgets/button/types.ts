import { WidgetConfig } from '../../src/types';

export interface ButtonConfig extends WidgetConfig {
  text: string;
  url: string;
  openInNewTab: boolean;
  size: 'small' | 'medium' | 'large';
  variant: 'primary' | 'secondary' | 'outline' | 'text';
  alignment: 'left' | 'center' | 'right';
  fullWidth: boolean;
  backgroundColor?: string;
  textColor?: string;
  borderRadius: number;
  padding: {
    vertical: number;
    horizontal: number;
  };
}
