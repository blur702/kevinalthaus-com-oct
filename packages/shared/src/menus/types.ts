import type { Role } from '../security/rbac-types';

export type MenuLocation = 'header' | 'footer' | 'custom';

export interface Menu {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  location: MenuLocation;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by?: string | null;
}

export interface MenuItem {
  id: string;
  menu_id: string;
  parent_id?: string | null;
  label: string;
  url: string;
  is_external: boolean;
  open_in_new_tab: boolean;
  icon?: string | null;
  rel?: string | null;
  order_index: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
  visibility_roles: Role[];
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by?: string | null;
  children?: MenuItem[];
}

export interface MenuWithItems extends Menu {
  items: MenuItem[];
}

export interface CreateMenuRequest {
  name: string;
  slug?: string;
  description?: string;
  location?: MenuLocation;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateMenuRequest {
  name?: string;
  slug?: string;
  description?: string | null;
  location?: MenuLocation;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CreateMenuItemRequest {
  label: string;
  url: string;
  parent_id?: string | null;
  is_external?: boolean;
  open_in_new_tab?: boolean;
  icon?: string | null;
  rel?: string | null;
  order_index?: number;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
  visibility_roles?: Role[];
}

export interface UpdateMenuItemRequest {
  label?: string;
  url?: string;
  parent_id?: string | null;
  is_external?: boolean;
  open_in_new_tab?: boolean;
  icon?: string | null;
  rel?: string | null;
  order_index?: number;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
  visibility_roles?: Role[];
}

