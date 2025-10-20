import { FrontendTheme, ThemeOverride } from './frontend-theme';
import { BackendTheme } from './backend-theme';

export interface PluginTheme {
  id: string;
  pluginId: string;
  name: string;
  version: string;
  type: 'frontend' | 'backend' | 'full';
  frontend?: FrontendTheme;
  backend?: BackendTheme;
  screenshots?: string[];
  demoUrl?: string;
}

export interface PluginThemeExtension {
  pluginId: string;
  targetTheme: string;
  overrides: ThemeOverride;
  priority?: number;
}

export interface ThemeRegistry {
  register(theme: PluginTheme): Promise<void>;
  unregister(themeId: string): Promise<void>;
  get(themeId: string): Promise<PluginTheme | null>;
  getAll(): Promise<PluginTheme[]>;
  getByPlugin(pluginId: string): Promise<PluginTheme[]>;
  getActive(): Promise<PluginTheme | null>;
  setActive(themeId: string): Promise<void>;
}

export interface ThemeManager {
  load(themeId: string): Promise<PluginTheme>;
  apply(theme: PluginTheme): Promise<void>;
  extend(extension: PluginThemeExtension): Promise<void>;
  compile(theme: PluginTheme): Promise<CompiledTheme>;
}

export interface CompiledTheme {
  css: string;
  variables: Record<string, string>;
  assets: string[];
}

export interface ThemeValidationResult {
  valid: boolean;
  errors: ThemeValidationError[];
  warnings: string[];
}

export interface ThemeValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ThemeAssetBundle {
  themeId: string;
  version: string;
  assets: {
    css: string[];
    js: string[];
    fonts: string[];
    images: string[];
  };
  integrity?: Record<string, string>;
}
