import { WidgetConfig } from '../../src/types';

export interface VideoConfig extends WidgetConfig {
  url: string;
  source: 'youtube' | 'vimeo' | 'direct';
  width: number;
  aspectRatio: '16:9' | '4:3' | '1:1' | '21:9';
  autoplay: boolean;
  controls: boolean;
  muted: boolean;
  loop: boolean;
  alignment: 'left' | 'center' | 'right';
}
