import type {
  Menu,
  MenuItem,
  MenuLocation,
  CreateMenuRequest,
  UpdateMenuRequest,
  CreateMenuItemRequest,
  UpdateMenuItemRequest,
} from '@monorepo/shared';

export type {
  Menu,
  MenuItem,
  MenuLocation,
  CreateMenuRequest,
  UpdateMenuRequest,
  CreateMenuItemRequest,
  UpdateMenuItemRequest,
};

export interface MenuResponse {
  menu: Menu & { items: MenuItem[] };
}

export interface MenuListResponse {
  menus: Array<Menu & { items: MenuItem[] }>;
}
