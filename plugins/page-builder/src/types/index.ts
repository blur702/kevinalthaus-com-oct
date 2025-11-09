/**
 * Complete type definitions for page builder data model.
 * Ensures type safety and validation for JSON storage.
 */

import Joi from 'joi';

/**
 * Page publication status
 */
export enum PageStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  SCHEDULED = 'scheduled',
  ARCHIVED = 'archived'
}

/**
 * Main page entity with layout and metadata
 */
export interface Page {
  id: string;
  title: string;
  slug: string;
  layout_json: PageLayout;
  meta_description?: string;
  meta_keywords?: string;
  status: PageStatus;
  publish_at?: Date;
  published_at?: Date;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by?: string;
  deleted_at?: Date;
  deleted_by?: string;
}

/**
 * Historical version of a page for audit trail
 */
export interface PageVersion {
  id: string;
  page_id: string;
  version_number: number;
  title: string;
  slug: string;
  layout_json: PageLayout;
  status: PageStatus;
  change_summary?: string;
  created_at: Date;
  created_by: string;
}

/**
 * Reusable page layout template
 */
export interface Template {
  id: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  layout_json: PageLayout;
  category?: string;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by?: string;
  deleted_at?: Date;
  deleted_by?: string;
}

/**
 * Reusable widget or widget group
 */
export interface ReusableBlock {
  id: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  block_json: WidgetConfig | WidgetConfig[];
  category?: string;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by?: string;
  deleted_at?: Date;
  deleted_by?: string;
}

/**
 * Complete page layout structure stored as JSONB
 */
export interface PageLayout {
  version: '1.0';
  grid: GridConfig;
  widgets: WidgetInstance[];
  metadata?: {
    seo?: Record<string, any>;
    accessibility?: Record<string, any>;
  };
}

/**
 * Grid configuration for responsive layout
 */
export interface GridConfig {
  columns: number;
  rows?: number;
  gap: {
    unit: 'px' | 'rem' | '%';
    value: number;
  };
  snapToGrid: boolean;
  breakpoints: Breakpoint[];
}

/**
 * Responsive breakpoint definition
 */
export interface Breakpoint {
  name: 'mobile' | 'tablet' | 'desktop' | 'wide';
  minWidth: number;
  maxWidth?: number;
  columns?: number;
}

/**
 * Widget instance in the layout
 */
export interface WidgetInstance {
  id: string; // UUID v4
  type: string; // e.g., 'text-content', 'image', 'video'
  position: GridPosition;
  config: WidgetConfig;
  children?: WidgetInstance[]; // For containers like accordion, tabs
  isLocked?: boolean; // Prevent editing in production
}

/**
 * Widget position in the grid with responsive support
 */
export interface GridPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  responsive?: ResponsivePosition[];
  zIndex?: number;
}

/**
 * Responsive position override for specific breakpoint
 */
export interface ResponsivePosition {
  breakpoint: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Widget-specific configuration
 * Must be JSON-serializable (no functions or circular references)
 */
export interface WidgetConfig {
  [key: string]: any;
}

/**
 * Validation schema for PageLayout using Joi
 */
export const pageLayoutSchema = Joi.object({
  version: Joi.string().valid('1.0').required(),
  grid: Joi.object({
    columns: Joi.number().integer().min(1).max(24).required(),
    rows: Joi.number().integer().min(1).optional(),
    gap: Joi.object({
      unit: Joi.string().valid('px', 'rem', '%').required(),
      value: Joi.number().min(0).max(100).required()
    }).required(),
    snapToGrid: Joi.boolean().required(),
    breakpoints: Joi.array().items(
      Joi.object({
        name: Joi.string().valid('mobile', 'tablet', 'desktop', 'wide').required(),
        minWidth: Joi.number().integer().min(0).required(),
        maxWidth: Joi.number().integer().min(0).optional(),
        columns: Joi.number().integer().min(1).max(24).optional()
      })
    ).min(1).required()
  }).required(),
  widgets: Joi.array().items(
    Joi.object({
      id: Joi.string().uuid().required(),
      type: Joi.string().required(),
      position: Joi.object({
        x: Joi.number().integer().min(0).required(),
        y: Joi.number().integer().min(0).required(),
        width: Joi.number().integer().min(1).required(),
        height: Joi.number().integer().min(1).required(),
        responsive: Joi.array().items(
          Joi.object({
            breakpoint: Joi.string().required(),
            x: Joi.number().integer().min(0).required(),
            y: Joi.number().integer().min(0).required(),
            width: Joi.number().integer().min(1).required(),
            height: Joi.number().integer().min(1).required()
          })
        ).optional(),
        zIndex: Joi.number().integer().optional()
      }).required(),
      config: Joi.object().unknown(true).required(),
      children: Joi.array().optional(),
      isLocked: Joi.boolean().optional()
    })
  ).min(0).max(100).required(),
  metadata: Joi.object({
    seo: Joi.object().unknown(true).optional(),
    accessibility: Joi.object().unknown(true).optional()
  }).optional()
});

/**
 * Validation schema for GridConfig
 */
export const gridConfigSchema = Joi.object({
  columns: Joi.number().integer().min(1).max(24).required(),
  rows: Joi.number().integer().min(1).optional(),
  gap: Joi.object({
    unit: Joi.string().valid('px', 'rem', '%').required(),
    value: Joi.number().min(0).max(100).required()
  }).required(),
  snapToGrid: Joi.boolean().required(),
  breakpoints: Joi.array().items(
    Joi.object({
      name: Joi.string().valid('mobile', 'tablet', 'desktop', 'wide').required(),
      minWidth: Joi.number().integer().min(0).required(),
      maxWidth: Joi.number().integer().min(0).optional(),
      columns: Joi.number().integer().min(1).max(24).optional()
    })
  ).min(1).required()
});

/**
 * Validation schema for WidgetInstance
 */
export const widgetInstanceSchema = Joi.object({
  id: Joi.string().uuid().required(),
  type: Joi.string().required(),
  position: Joi.object({
    x: Joi.number().integer().min(0).required(),
    y: Joi.number().integer().min(0).required(),
    width: Joi.number().integer().min(1).required(),
    height: Joi.number().integer().min(1).required(),
    responsive: Joi.array().items(
      Joi.object({
        breakpoint: Joi.string().required(),
        x: Joi.number().integer().min(0).required(),
        y: Joi.number().integer().min(0).required(),
        width: Joi.number().integer().min(1).required(),
        height: Joi.number().integer().min(1).required()
      })
    ).optional(),
    zIndex: Joi.number().integer().optional()
  }).required(),
  config: Joi.object().unknown(true).required(),
  children: Joi.array().optional(),
  isLocked: Joi.boolean().optional()
});

/**
 * Default grid configuration
 */
export const defaultGridConfig: GridConfig = {
  columns: 12,
  gap: {
    unit: 'px',
    value: 16
  },
  snapToGrid: true,
  breakpoints: [
    { name: 'mobile', minWidth: 0, maxWidth: 767, columns: 4 },
    { name: 'tablet', minWidth: 768, maxWidth: 1023, columns: 8 },
    { name: 'desktop', minWidth: 1024, maxWidth: 1439, columns: 12 },
    { name: 'wide', minWidth: 1440, columns: 16 }
  ]
};

/**
 * Create a new empty page layout
 */
export function createEmptyLayout(): PageLayout {
  return {
    version: '1.0',
    grid: defaultGridConfig,
    widgets: [],
    metadata: {}
  };
}

/**
 * Validate page layout and throw if invalid
 */
export function validatePageLayout(layout: any): PageLayout {
  const { error, value } = pageLayoutSchema.validate(layout, {
    abortEarly: false,
    stripUnknown: false
  });

  if (error) {
    throw new Error(`Invalid page layout: ${error.message}`);
  }

  return value as PageLayout;
}

/**
 * Validate widget instance and throw if invalid
 */
export function validateWidgetInstance(widget: any): WidgetInstance {
  const { error, value } = widgetInstanceSchema.validate(widget, {
    abortEarly: false,
    stripUnknown: false
  });

  if (error) {
    throw new Error(`Invalid widget instance: ${error.message}`);
  }

  return value as WidgetInstance;
}
