/**
 * Page Builder Frontend - TypeScript Type Definitions
 *
 * Defines frontend-specific interfaces and re-exports backend types
 */

import type { Layout } from 'react-grid-layout';

// Re-export backend types
export type {
  PageLayout,
  WidgetInstance,
  GridConfig,
  GridPosition,
  GridSpacing,
  WidgetConfig,
  WidgetRegistryEntry,
  WidgetManifest,
  WidgetCategory,
  PageMetadata,
  TemplateMetadata,
  ReusableBlockMetadata,
} from '../../../src/types';

/**
 * Editor mode type
 */
export type EditorMode = 'edit' | 'preview' | 'mobile' | 'tablet' | 'desktop';

/**
 * Property panel tab type
 */
export type PropertyPanelTab = 'content' | 'style' | 'advanced';

/**
 * Drag item interface for drag-and-drop operations
 */
export interface DragItem {
  /** Type of the draggable item */
  type: string;
  /** Unique identifier */
  id: string;
  /** Widget type (for palette items) */
  widgetType?: string;
  /** Metadata for the drag operation */
  metadata?: Record<string, unknown>;
}

/**
 * Drop result interface
 */
export interface DropResult {
  /** Drop target ID */
  targetId: string | null;
  /** Drop position */
  position: {
    x: number;
    y: number;
  };
  /** Whether the drop was successful */
  success: boolean;
}

/**
 * Widget selection state
 */
export interface WidgetSelection {
  /** Selected widget ID */
  id: string;
  /** Widget position in grid */
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

/**
 * Page builder state interface
 */
export interface PageBuilderState {
  /** Current page layout */
  layout: import('../../../src/types').PageLayout;
  /** Selected widget */
  selectedWidget: import('../../../src/types').WidgetInstance | null;
  /** Editor mode */
  editorMode: EditorMode;
  /** Undo/redo history */
  history: {
    past: import('../../../src/types').PageLayout[];
    future: import('../../../src/types').PageLayout[];
  };
  /** Unsaved changes flag */
  isDirty: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
}

/**
 * Extended grid layout item with widget data
 */
export interface GridLayoutItem extends Layout {
  /** Widget instance ID */
  widgetId: string;
  /** Widget type */
  widgetType: string;
  /** Widget configuration */
  config?: import('../../../src/types').WidgetConfig;
  /** Whether widget is locked */
  isLocked?: boolean;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Filter options for fetching pages
 */
export interface PageFilterOptions extends PaginationOptions {
  status?: 'draft' | 'published' | 'archived';
  search?: string;
  tags?: string[];
}

/**
 * Widget palette item
 */
export interface WidgetPaletteItem {
  type: string;
  name: string;
  description: string;
  icon: string;
  category: import('../../../src/types').WidgetCategory;
  isDeprecated: boolean;
  isContainer: boolean;
}

/**
 * Property field configuration
 */
export interface PropertyFieldConfig {
  name: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'color' | 'image' | 'richtext';
  defaultValue?: unknown;
  options?: Array<{ label: string; value: unknown }>;
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
  };
}

/**
 * Widget render props
 */
export interface WidgetRenderProps {
  widget: import('../../../src/types').WidgetInstance;
  editMode: boolean;
  onChange?: (config: Record<string, unknown>) => void;
  onSelect?: () => void;
  isSelected?: boolean;
}
