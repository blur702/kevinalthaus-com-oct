import { PluginCapability } from '../constants';

export interface PluginManifest {
  name: string;
  version: string;
  displayName: string;
  description: string;
  author: {
    name: string;
    email?: string;
    url?: string;
  };
  homepage?: string;
  repository?: {
    type: string;
    url: string;
  };
  license?: string;
  keywords?: string[];
  capabilities: PluginCapability[];
  hooks?: PluginHooks;
  dependencies?: Record<string, string>;
  entrypoint: string;
  frontend?: {
    entrypoint: string;
    assets?: string[];
  };
  backend?: {
    entrypoint: string;
    api?: ApiEndpoint[];
  };
  database?: {
    migrations?: string[];
    schemas?: string[];
  };
  settings?: PluginSettings;
  minimumSystemVersion?: string;
  compatibility?: {
    node?: string;
    npm?: string;
  };
}

export interface PluginHooks {
  install?: string;
  activate?: string;
  deactivate?: string;
  uninstall?: string;
  update?: string;
}

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  handler: string;
  middleware?: string[];
  requiredCapabilities?: PluginCapability[];
}

export interface PluginSettings {
  schema: Record<string, PluginSettingField>;
  defaults?: Record<string, unknown>;
}

export interface PluginSettingField {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  label: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: unknown[];
  };
}
