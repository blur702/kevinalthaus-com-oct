export interface NavigationMenuItem {
  id: string;
  label: string;
  url: string;
  is_external: boolean;
  open_in_new_tab: boolean;
  icon?: string | null;
  rel?: string | null;
  children?: NavigationMenuItem[];
}

export interface NavigationMenu {
  id: string;
  name: string;
  slug: string;
  location: 'header' | 'footer' | 'custom';
  is_active: boolean;
  items: NavigationMenuItem[];
}

interface PublicMenuResponse {
  menu: NavigationMenu;
}

const PUBLIC_MENU_BASE = '/api/public-menus';

function isNavigationMenu(value: unknown): value is NavigationMenu {
  if (typeof value !== 'object' || value === null) return false;
  const menu = value as Record<string, unknown>;
  return (
    typeof menu.id === 'string' &&
    typeof menu.name === 'string' &&
    typeof menu.slug === 'string' &&
    typeof menu.is_active === 'boolean' &&
    Array.isArray(menu.items)
  );
}

function isPublicMenuResponse(value: unknown): value is PublicMenuResponse {
  if (typeof value !== 'object' || value === null) return false;
  const response = value as Record<string, unknown>;
  return 'menu' in response && isNavigationMenu(response.menu);
}

export async function fetchNavigationMenu(
  slug: string,
  signal?: AbortSignal
): Promise<NavigationMenu> {
  const response = await fetch(`${PUBLIC_MENU_BASE}/${encodeURIComponent(slug)}`, {
    method: 'GET',
    credentials: 'include',
    signal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load menu (${response.status})`);
  }

  const data: unknown = await response.json();

  if (!isPublicMenuResponse(data)) {
    throw new Error('Invalid menu response format');
  }

  return data.menu;
}
