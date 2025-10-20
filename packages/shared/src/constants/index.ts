export const PLUGIN_MANIFEST_FILENAME = 'plugin.yaml';
export const PLUGIN_DIRECTORY = 'plugins';
export const PLUGIN_UPLOAD_MAX_SIZE = 50 * 1024 * 1024; // 50MB

export const API_VERSION = 'v1';
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export enum PluginStatus {
  INSTALLED = 'installed',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  UPDATING = 'updating',
}

export enum PluginLifecycleHook {
  INSTALL = 'install',
  ACTIVATE = 'activate',
  DEACTIVATE = 'deactivate',
  UNINSTALL = 'uninstall',
  UPDATE = 'update',
}

export const ALLOWED_PLUGIN_CAPABILITIES = [
  'database:read',
  'database:write',
  'api:call',
  'theme:modify',
  'settings:read',
  'settings:write',
] as const;

export type PluginCapability = (typeof ALLOWED_PLUGIN_CAPABILITIES)[number];
