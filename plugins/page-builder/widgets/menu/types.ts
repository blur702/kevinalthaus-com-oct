export type MenuOrientation = 'horizontal' | 'vertical';
export type MenuVariant = 'links' | 'buttons';
export type MenuAlignment = 'left' | 'center' | 'right';

export interface MenuWidgetConfig {
  menuSlug: string;
  orientation: MenuOrientation;
  variant: MenuVariant;
  alignment: MenuAlignment;
  showIcons: boolean;
  showDescriptions: boolean;
}

export interface PublicMenuItem {
  id: string;
  label: string;
  url: string;
  is_external: boolean;
  open_in_new_tab: boolean;
  icon?: string | null;
  rel?: string | null;
  children?: PublicMenuItem[];
}

export interface PublicMenuResponse {
  menu: {
    id: string;
    name: string;
    slug: string;
    location: string;
    items: PublicMenuItem[];
  };
}
