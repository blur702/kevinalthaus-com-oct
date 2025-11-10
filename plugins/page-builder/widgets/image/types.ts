import { WidgetConfig } from '../../src/types';

export interface ImageConfig extends WidgetConfig {
  src: string;
  alt: string;
  caption?: string;
  width: number;
  height?: number;
  objectFit: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  alignment: 'left' | 'center' | 'right';
  borderRadius: number;
  linkUrl?: string;
  openInNewTab: boolean;
}
