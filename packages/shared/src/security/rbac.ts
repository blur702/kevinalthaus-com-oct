// Import and re-export enums from rbac-types (browser-safe)
import { Role, Capability } from './rbac-types';
export { Role, Capability };

export interface Permission {
  role: Role;
  capabilities: Capability[];
}

export interface PermissionContext {
  userId: string;
  role: Role;
  capabilities: Capability[];
}

const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  [Role.ADMIN]: [
    Capability.PLUGIN_INSTALL,
    Capability.PLUGIN_ACTIVATE,
    Capability.PLUGIN_DEACTIVATE,
    Capability.PLUGIN_UNINSTALL,
    Capability.PLUGIN_UPDATE,
    Capability.PLUGIN_VIEW,
    Capability.THEME_MODIFY,
    Capability.THEME_VIEW,
    Capability.SETTINGS_READ,
    Capability.SETTINGS_WRITE,
    Capability.USER_MANAGE,
    Capability.USER_VIEW,
    Capability.CONTENT_CREATE,
    Capability.CONTENT_EDIT,
    Capability.CONTENT_DELETE,
    Capability.CONTENT_VIEW,
  ],
  [Role.EDITOR]: [
    Capability.PLUGIN_VIEW,
    Capability.THEME_VIEW,
    Capability.SETTINGS_READ,
    Capability.CONTENT_CREATE,
    Capability.CONTENT_EDIT,
    Capability.CONTENT_DELETE,
    Capability.CONTENT_VIEW,
  ],
  [Role.VIEWER]: [
    Capability.PLUGIN_VIEW,
    Capability.THEME_VIEW,
    Capability.SETTINGS_READ,
    Capability.CONTENT_VIEW,
  ],
  [Role.GUEST]: [Capability.CONTENT_VIEW],
};

export function hasCapability(context: PermissionContext, capability: Capability): boolean {
  return context.capabilities.includes(capability);
}

export function hasAnyCapability(context: PermissionContext, capabilities: Capability[]): boolean {
  return capabilities.some((cap) => hasCapability(context, cap));
}

export function hasAllCapabilities(
  context: PermissionContext,
  capabilities: Capability[]
): boolean {
  return capabilities.every((cap) => hasCapability(context, cap));
}

export function getCapabilitiesForRole(role: Role): Capability[] {
  return ROLE_CAPABILITIES[role] || [];
}

export function createPermissionContext(userId: string, role: Role): PermissionContext {
  return {
    userId,
    role,
    capabilities: getCapabilitiesForRole(role),
  };
}

export function canPerformAction(
  context: PermissionContext,
  requiredCapability: Capability
): boolean {
  return hasCapability(context, requiredCapability);
}

export function filterByPermission<T extends { requiredCapability?: Capability }>(
  items: T[],
  context: PermissionContext
): T[] {
  return items.filter((item) => {
    if (!item.requiredCapability) {
      return true;
    }
    return hasCapability(context, item.requiredCapability);
  });
}
