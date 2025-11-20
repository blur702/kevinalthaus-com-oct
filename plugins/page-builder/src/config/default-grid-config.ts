import type { GridConfig } from '../types';

export const defaultGridConfigData: GridConfig = {
  columns: 12,
  gap: {
    unit: 'px',
    value: 16,
  },
  snapToGrid: true,
  breakpoints: [
    { name: 'mobile', minWidth: 0, maxWidth: 767, columns: 4 },
    { name: 'tablet', minWidth: 768, maxWidth: 1023, columns: 8 },
    { name: 'desktop', minWidth: 1024, maxWidth: 1439, columns: 12 },
    { name: 'wide', minWidth: 1440, columns: 16 },
  ],
};
