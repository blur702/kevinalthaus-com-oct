import api from '../lib/api';
import type {
  CreateMenuRequest,
  UpdateMenuRequest,
  CreateMenuItemRequest,
  UpdateMenuItemRequest,
  MenuListResponse,
  MenuResponse,
  MenuItem,
} from '../types/menu';

export async function listMenus(includeItems = true): Promise<MenuListResponse> {
  const response = await api.get<MenuListResponse>('/menus', {
    params: { includeItems },
  });
  return response.data;
}

export async function getMenu(id: string, includeItems = true): Promise<MenuResponse> {
  const response = await api.get<MenuResponse>(`/menus/${encodeURIComponent(id)}`, {
    params: { includeItems },
  });
  return response.data;
}

export async function createMenu(data: CreateMenuRequest): Promise<MenuResponse> {
  const response = await api.post<MenuResponse>('/menus', data);
  return response.data;
}

export async function updateMenu(id: string, data: UpdateMenuRequest): Promise<MenuResponse> {
  const response = await api.put<MenuResponse>(`/menus/${encodeURIComponent(id)}`, data);
  return response.data;
}

export async function deleteMenu(id: string): Promise<void> {
  await api.delete(`/menus/${encodeURIComponent(id)}`);
}

export async function createMenuItem(
  menuId: string,
  data: CreateMenuItemRequest
): Promise<{ item: MenuItem }> {
  const response = await api.post<{ item: MenuItem }>(
    `/menus/${encodeURIComponent(menuId)}/items`,
    data
  );
  return response.data;
}

export async function updateMenuItem(
  menuId: string,
  itemId: string,
  data: UpdateMenuItemRequest
): Promise<{ item: MenuItem }> {
  const response = await api.put<{ item: MenuItem }>(
    `/menus/${encodeURIComponent(menuId)}/items/${encodeURIComponent(itemId)}`,
    data
  );
  return response.data;
}

export async function deleteMenuItem(menuId: string, itemId: string): Promise<void> {
  await api.delete(`/menus/${encodeURIComponent(menuId)}/items/${encodeURIComponent(itemId)}`);
}
