/**
 * Complete type definitions for page builder data model.
 * Ensures type safety and validation for JSON storage.
 */

import Joi from 'joi';
// Note: This file includes a small runtime helper that checks widget structure on disk.
// Import Node modules at top-level for proper typing and to avoid inline require usage.
import * as fs from 'fs';
import * as path from 'path';
import defaultGridConfigJson from '../config/default-grid-config.json';

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
const { error: gridConfigError, value: validatedGridConfig } = gridConfigSchema.validate(defaultGridConfigJson, {
  abortEarly: false,
  stripUnknown: false
});

if (gridConfigError) {
  throw new Error(`Invalid default grid config: ${gridConfigError.message}`);
}

export const defaultGridConfig: GridConfig = validatedGridConfig as GridConfig;

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

// =========================================================================
// WIDGET REGISTRY TYPES
// =========================================================================

/**
 * Standard widget categories for organizing the widget palette
 */
export enum WidgetCategory {
  GENERAL = 'general',
  CREATIVE = 'creative',
  MARKETING = 'marketing',
  HEADER_FOOTER = 'header-footer',
  SOCIAL_MEDIA = 'social-media',
  FORMS = 'forms',
  ADVANCED = 'advanced'
}

/**
 * Widget manifest structure from widget.json files
 */
export interface WidgetManifest {
  type: string; // Unique widget identifier (kebab-case)
  name: string; // Display name
  displayName: string; // Human-readable name
  description: string; // Widget description
  category: string; // Widget category
  icon: string; // Icon identifier or path
  version: string; // Semantic version
  author: {
    name: string;
    email: string;
  };
  configSchema: string; // Reference to config.ts file
  previewImage?: string; // Optional thumbnail
  tags: string[]; // Search tags
  isContainer: boolean; // Can contain child widgets
  deprecated: boolean; // Mark as deprecated
}

/**
 * Widget registry entry with runtime information
 */
export interface WidgetRegistryEntry extends WidgetManifest {
  componentPath: string; // Relative path to component.tsx
  configSchemaPath: string; // Path to config.ts
  typesPath: string; // Path to types.ts
  isValid: boolean; // Validation status
  validationErrors: string[]; // Validation error messages
  loadedAt: Date; // Discovery timestamp
}

/**
 * API response structure for widget registry
 */
export interface WidgetRegistryResponse {
  widgets: WidgetRegistryEntry[];
  total: number;
  categories: string[];
  version: string;
}

/**
 * Validation schema for widget category
 */
export const widgetCategorySchema = Joi.string().valid(
  ...Object.values(WidgetCategory)
);

/**
 * Validation schema for widget manifest (widget.json)
 */
export const widgetManifestSchema = Joi.object({
  type: Joi.string().pattern(/^[a-z0-9-]+$/).required(),
  name: Joi.string().min(1).max(100).required(),
  displayName: Joi.string().min(1).max(100).required(),
  description: Joi.string().min(1).max(500).required(),
  category: widgetCategorySchema.required(),
  icon: Joi.string().min(1).max(200).required(),
  version: Joi.string().pattern(/^\d+\.\d+\.\d+$/).required(),
  author: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    email: Joi.string().email().required()
  }).required(),
  configSchema: Joi.string().valid('config.ts').required(),
  previewImage: Joi.string().max(500).optional().allow(null),
  tags: Joi.array().items(Joi.string().min(1).max(50)).min(0).max(20).required(),
  isContainer: Joi.boolean().required(),
  deprecated: Joi.boolean().required()
});

/**
 * Validate widget manifest and throw if invalid
 */
export function validateWidgetManifest(data: any): WidgetManifest {
  const { error, value } = widgetManifestSchema.validate(data, {
    abortEarly: false,
    stripUnknown: false
  });

  if (error) {
    throw new Error(`Invalid widget manifest: ${error.message}`);
  }

  return value as WidgetManifest;
}

/**
 * Check if widget has required file structure
 */
/**
 * Checks whether a widget directory contains the required files.
 * Synchronous implementation for compatibility; note this performs blocking I/O.
 * Consider migrating callers to an async variant if used in performance-sensitive code.
 */
export function isValidWidgetStructure(widgetPath: string): boolean {
  const requiredFiles = ['widget.json', 'component.tsx', 'config.ts', 'types.ts'];

  for (const file of requiredFiles) {
    const filePath = path.join(widgetPath, file);
    if (!fs.existsSync(filePath)) {
      return false;
    }
  }

  return true;
}
