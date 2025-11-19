import type { GridConfig, WidgetCategory } from '../../../src/types';
import defaultGridConfigJson from '../../../src/config/default-grid-config.json';

export const DEFAULT_GRID_CONFIG: GridConfig = {
  ...defaultGridConfigJson,
  gap: { ...defaultGridConfigJson.gap },
  breakpoints: [...defaultGridConfigJson.breakpoints],
} as GridConfig;

export const DEFAULT_GRID_COLUMNS = DEFAULT_GRID_CONFIG.columns;
export const DEFAULT_GRID_GAP = DEFAULT_GRID_CONFIG.gap;

export const BREAKPOINTS = DEFAULT_GRID_CONFIG.breakpoints.reduce<
  Record<string, (typeof DEFAULT_GRID_CONFIG.breakpoints)[number]>
>((acc, breakpoint) => {
  acc[breakpoint.name] = breakpoint;
  return acc;
}, {});

export const WIDGET_MIN_WIDTH = 1;
export const WIDGET_MIN_HEIGHT = 1;
export const WIDGET_DEFAULT_WIDTH = 4;
export const WIDGET_DEFAULT_HEIGHT = 2;

export const EDITOR_MODES: Array<'edit' | 'preview' | 'mobile' | 'tablet' | 'desktop'> = [
  'edit',
  'preview',
  'mobile',
  'tablet',
  'desktop',
];

export const PROPERTY_PANEL_WIDTH = 320;
export const WIDGET_PALETTE_WIDTH = 240;
export const TOOLBAR_HEIGHT = 64;
export const DRAG_HANDLE_SIZE = 24;
export const UNDO_HISTORY_LIMIT = 50;
export const AUTO_SAVE_DELAY = 2000;

export const WIDGET_CATEGORIES: WidgetCategory[] = [
  'general',
  'creative',
  'marketing',
  'header-footer',
  'social-media',
  'forms',
  'advanced',
];

export const SUPPORTED_LAYOUT_VERSIONS = ['1.0'] as const;
