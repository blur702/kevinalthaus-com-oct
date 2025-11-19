/**
 * Page Builder Frontend - Main Entry Point
 *
 * Exports the PageBuilderEditor component and related components/types
 * for use in other packages.
 */

export { default as PageBuilderEditor } from './components/PageBuilderEditor';
export { default as WidgetPalette } from './components/WidgetPalette';
export { default as GridCanvas } from './components/GridCanvas';
export { default as PropertyPanel } from './components/PropertyPanel';
export { default as WidgetWrapper } from './components/WidgetWrapper';

// Export hooks for external use
export { usePageBuilder, useDragDrop, useGrid } from './hooks';

// Export types
export type {
  DragItem,
  DropResult,
  EditorMode,
  WidgetSelection,
  PageBuilderState,
  GridLayoutItem,
  PropertyPanelTab,
} from './types';

// Re-export backend types for convenience
export type {
  PageLayout,
  WidgetInstance,
  GridConfig,
  GridPosition,
  WidgetConfig,
  WidgetRegistryEntry,
  WidgetManifest,
  WidgetCategory,
} from '../../src/types';
