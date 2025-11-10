import { WidgetConfig } from '../../src/types';

export interface CarouselSlide {
  id: string;
  imageUrl: string;
  caption?: string;
  alt: string;
}

export interface CarouselConfig extends WidgetConfig {
  slides: CarouselSlide[];
  autoPlay: boolean;
  interval: number;
  showDots: boolean;
  showArrows: boolean;
  height: number;
}
