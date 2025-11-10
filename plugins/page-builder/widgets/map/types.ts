import { WidgetConfig } from '../../src/types';

export interface MapConfig extends WidgetConfig {
  address: string;
  latitude?: number;
  longitude?: number;
  zoom: number;
  height: number;
  mapType: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
  showMarker: boolean;
}
