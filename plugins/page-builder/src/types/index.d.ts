/**
 * Complete type definitions for page builder data model.
 * Ensures type safety and validation for JSON storage.
 */
import Joi from 'joi';
/**
 * Page publication status
 */
export declare enum PageStatus {
    DRAFT = "draft",
    PUBLISHED = "published",
    SCHEDULED = "scheduled",
    ARCHIVED = "archived"
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
    id: string;
    type: string;
    position: GridPosition;
    config: WidgetConfig;
    children?: WidgetInstance[];
    isLocked?: boolean;
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
export declare const pageLayoutSchema: Joi.ObjectSchema<any>;
/**
 * Validation schema for GridConfig
 */
export declare const gridConfigSchema: Joi.ObjectSchema<any>;
/**
 * Validation schema for WidgetInstance
 */
export declare const widgetInstanceSchema: Joi.ObjectSchema<any>;
/**
 * Default grid configuration
 */
export declare const defaultGridConfig: GridConfig;
/**
 * Create a new empty page layout
 */
export declare function createEmptyLayout(): PageLayout;
/**
 * Validate page layout and throw if invalid
 */
export declare function validatePageLayout(layout: any): PageLayout;
/**
 * Validate widget instance and throw if invalid
 */
export declare function validateWidgetInstance(widget: any): WidgetInstance;
/**
 * Standard widget categories for organizing the widget palette
 */
export declare enum WidgetCategory {
    GENERAL = "general",
    CREATIVE = "creative",
    MARKETING = "marketing",
    HEADER_FOOTER = "header-footer",
    SOCIAL_MEDIA = "social-media",
    FORMS = "forms",
    ADVANCED = "advanced"
}
/**
 * Widget manifest structure from widget.json files
 */
export interface WidgetManifest {
    type: string;
    name: string;
    displayName: string;
    description: string;
    category: string;
    icon: string;
    version: string;
    author: {
        name: string;
        email: string;
    };
    configSchema: string;
    previewImage?: string;
    tags: string[];
    isContainer: boolean;
    deprecated: boolean;
}
/**
 * Widget registry entry with runtime information
 */
export interface WidgetRegistryEntry extends WidgetManifest {
    componentPath: string;
    configSchemaPath: string;
    typesPath: string;
    isValid: boolean;
    validationErrors: string[];
    loadedAt: Date;
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
export declare const widgetCategorySchema: Joi.StringSchema<string>;
/**
 * Validation schema for widget manifest (widget.json)
 */
export declare const widgetManifestSchema: Joi.ObjectSchema<any>;
/**
 * Validate widget manifest and throw if invalid
 */
export declare function validateWidgetManifest(data: any): WidgetManifest;
/**
 * Check if widget has required file structure
 */
/**
 * Checks whether a widget directory contains the required files.
 * Synchronous implementation for compatibility; note this performs blocking I/O.
 * Consider migrating callers to an async variant if used in performance-sensitive code.
 */
export declare function isValidWidgetStructure(widgetPath: string): boolean;
//# sourceMappingURL=index.d.ts.map