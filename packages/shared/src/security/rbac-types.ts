// RBAC type definitions (browser-safe, no server dependencies)

export enum Role {
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
  GUEST = 'guest',
}

export enum Capability {
  // Plugin management
  PLUGIN_INSTALL = 'plugin:install',
  PLUGIN_ACTIVATE = 'plugin:activate',
  PLUGIN_DEACTIVATE = 'plugin:deactivate',
  PLUGIN_UNINSTALL = 'plugin:uninstall',
  PLUGIN_UPDATE = 'plugin:update',
  PLUGIN_VIEW = 'plugin:view',

  // Theme management
  THEME_MODIFY = 'theme:modify',
  THEME_VIEW = 'theme:view',

  // Settings management
  SETTINGS_READ = 'settings:read',
  SETTINGS_WRITE = 'settings:write',

  // User management
  USER_MANAGE = 'user:manage',
  USER_VIEW = 'user:view',

  // Content management
  CONTENT_CREATE = 'content:create',
  CONTENT_EDIT = 'content:edit',
  CONTENT_DELETE = 'content:delete',
  CONTENT_VIEW = 'content:view',
}
