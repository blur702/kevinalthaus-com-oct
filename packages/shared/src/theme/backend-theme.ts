export interface BackendTheme {
  name: string;
  version: string;
  templates: ThemeTemplates;
  layouts: ThemeLayouts;
  partials?: ThemePartials;
  assets?: ThemeAssets;
  settings?: ThemeSettings;
}

export interface ThemeTemplates {
  [templateName: string]: TemplateDefinition;
}

export interface TemplateDefinition {
  path: string;
  layout?: string;
  metadata?: TemplateMetadata;
  regions?: TemplateRegion[];
}

export interface TemplateMetadata {
  title?: string;
  description?: string;
  category?: string;
  preview?: string;
  responsive?: boolean;
}

export interface TemplateRegion {
  id: string;
  name: string;
  description?: string;
  allowedComponents?: string[];
  maxComponents?: number;
}

export interface ThemeLayouts {
  [layoutName: string]: LayoutDefinition;
}

export interface LayoutDefinition {
  path: string;
  regions: string[];
  defaultTemplate?: string;
  metadata?: {
    description?: string;
    preview?: string;
  };
}

export interface ThemePartials {
  [partialName: string]: string;
}

export interface ThemeAssets {
  styles?: string[];
  scripts?: string[];
  images?: string[];
  fonts?: FontDefinition[];
}

export interface FontDefinition {
  family: string;
  variants: FontVariant[];
  display?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional';
}

export interface FontVariant {
  weight: number;
  style: 'normal' | 'italic';
  url: string;
  format: 'woff' | 'woff2' | 'ttf' | 'otf';
}

export interface ThemeSettings {
  schema: Record<string, ThemeSettingField>;
  defaults?: Record<string, unknown>;
}

export interface ThemeSettingField {
  type: 'text' | 'textarea' | 'color' | 'image' | 'select' | 'checkbox';
  label: string;
  description?: string;
  default?: unknown;
  options?: Array<{ label: string; value: unknown }>;
}

export interface ThemeRenderContext {
  template: string;
  layout?: string;
  data: Record<string, unknown>;
  settings?: Record<string, unknown>;
  partials?: Record<string, string>;
}

export interface ThemeHooks {
  beforeRender?(context: ThemeRenderContext): Promise<ThemeRenderContext>;
  afterRender?(html: string, context: ThemeRenderContext): Promise<string>;
}
