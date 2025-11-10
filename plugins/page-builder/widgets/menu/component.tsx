import React from 'react';
import type { WidgetInstance, WidgetConfig } from '../../src/types';
import type { MenuWidgetConfig, PublicMenuItem } from './types';
import styles from './styles.module.css';

interface MenuWidgetProps {
  widget: WidgetInstance;
  editMode: boolean;
  onChange?: (config: WidgetConfig) => void;
}

interface AdminMenuListResponse {
  menus: Array<{ id: string; name: string; slug: string }>;
}

const PUBLIC_MENU_BASE = '/api/public-menus';
const ADMIN_MENU_BASE = '/api/menus';

function isValidMenuItem(item: unknown): item is PublicMenuItem {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.label === 'string' &&
    typeof obj.url === 'string' &&
    (obj.children === undefined || Array.isArray(obj.children))
  );
}

function validateMenuData(data: unknown): PublicMenuItem[] {
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  if (!obj.menu || typeof obj.menu !== 'object') return [];
  const menu = obj.menu as Record<string, unknown>;
  if (!Array.isArray(menu.items)) return [];
  return menu.items.filter(isValidMenuItem);
}

export default function MenuWidget({ widget, editMode, onChange }: MenuWidgetProps) {
  const config = widget.config as MenuWidgetConfig;
  const [menuItems, setMenuItems] = React.useState<PublicMenuItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [menuOptions, setMenuOptions] = React.useState<Array<{ id: string; name: string; slug: string }>>([]);

  const handleConfigChange = (updates: Partial<MenuWidgetConfig>) => {
    if (onChange) {
      onChange({ ...config, ...updates });
    }
  };

  const loadMenu = React.useCallback(
    async (slug: string, signal?: AbortSignal) => {
      if (!slug) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${PUBLIC_MENU_BASE}/${encodeURIComponent(slug)}`, {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json' },
          signal,
        });
        if (!response.ok) {
          throw new Error(`Failed to load menu (${response.status})`);
        }
        const data = await response.json();
        const validatedItems = validateMenuData(data);
        if (validatedItems.length === 0 && data?.menu?.items?.length > 0) {
          console.warn('[MenuWidget] Received invalid menu data, items failed validation');
        }
        setMenuItems(validatedItems);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        console.error('[MenuWidget] Failed to load menu', err);
        setError('Unable to load menu items.');
        setMenuItems([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  React.useEffect(() => {
    const controller = new AbortController();
    void loadMenu(config.menuSlug, controller.signal);
    return () => controller.abort();
  }, [config.menuSlug, loadMenu]);

  React.useEffect(() => {
    if (!editMode) return;
    const controller = new AbortController();
    fetch(`${ADMIN_MENU_BASE}?includeItems=false`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load menus');
        const data = (await res.json()) as AdminMenuListResponse;
        setMenuOptions(data.menus ?? []);
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        console.warn('[MenuWidget] Failed to load admin menus, using default', err);
        setMenuOptions([]);
      });
    return () => controller.abort();
  }, [editMode]);

  const renderMenuItems = (items: PublicMenuItem[], depth = 0): React.ReactNode => {
    if (!items || items.length === 0) return null;
    return (
      <ul className={`${styles.list} ${depth > 0 ? styles.depth1 : ''}`}>
        {items.map((item) => {
          const linkProps = item.is_external
            ? {
                href: item.url,
                target: item.open_in_new_tab ? '_blank' : '_self',
                rel: item.open_in_new_tab ? item.rel || 'noopener noreferrer' : item.rel || undefined,
              }
            : { href: item.url };
          return (
            <li key={item.id} className={styles.item}>
              <a className={styles.link} {...linkProps}>
                {config.showIcons && item.icon && <span className={styles.icon} aria-hidden="true">{item.icon}</span>}
                <span>{item.label}</span>
              </a>
              {item.children && item.children.length > 0 && renderMenuItems(item.children, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  if (editMode) {
    return (
      <div className={styles.editor}>
        <label htmlFor={`menu-${widget.id}`}>Menu</label>
        <select
          id={`menu-${widget.id}`}
          value={config.menuSlug}
          onChange={(event) => handleConfigChange({ menuSlug: event.target.value })}
        >
          {menuOptions.length === 0 && (
            <option value={config.menuSlug}>{config.menuSlug}</option>
          )}
          {menuOptions.map((menu) => (
            <option key={menu.id} value={menu.slug}>
              {menu.name}
            </option>
          ))}
        </select>

        <label htmlFor={`orientation-${widget.id}`}>Orientation</label>
        <select
          id={`orientation-${widget.id}`}
          value={config.orientation}
          onChange={(event) =>
            handleConfigChange({ orientation: event.target.value as MenuWidgetConfig['orientation'] })
          }
        >
          <option value="horizontal">Horizontal</option>
          <option value="vertical">Vertical</option>
        </select>

        <label htmlFor={`variant-${widget.id}`}>Style</label>
        <select
          id={`variant-${widget.id}`}
          value={config.variant}
          onChange={(event) =>
            handleConfigChange({ variant: event.target.value as MenuWidgetConfig['variant'] })
          }
        >
          <option value="links">Links</option>
          <option value="buttons">Buttons</option>
        </select>

        <label htmlFor={`alignment-${widget.id}`}>Alignment</label>
        <select
          id={`alignment-${widget.id}`}
          value={config.alignment}
          onChange={(event) =>
            handleConfigChange({ alignment: event.target.value as MenuWidgetConfig['alignment'] })
          }
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>

        <div className={styles.options}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={config.showIcons}
              onChange={(event) => handleConfigChange({ showIcons: event.target.checked })}
            />
            Show icons
          </label>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={config.showDescriptions}
              onChange={(event) => handleConfigChange({ showDescriptions: event.target.checked })}
            />
            Show descriptions
          </label>
        </div>

        <div className={styles.preview}>
          <p className={styles.previewLabel}>Preview</p>
          {loading ? <p>Loading menu…</p> : renderMenuItems(menuItems)}
        </div>
      </div>
    );
  }

  const customProps = {
    '--menu-alignment': config.alignment,
    '--menu-display': config.orientation === 'horizontal' ? 'flex' : 'block',
    '--menu-gap': config.orientation === 'horizontal' ? '16px' : '0',
    '--menu-flex-wrap': config.orientation === 'horizontal' ? 'wrap' : 'nowrap',
    '--menu-item-margin': config.orientation === 'vertical' ? '8px' : '0',
    '--menu-link-padding': config.variant === 'buttons' ? '8px 16px' : '0',
    '--menu-link-radius': config.variant === 'buttons' ? '999px' : '0',
    '--menu-link-bg': config.variant === 'buttons' ? '#1976d2' : 'transparent',
    '--menu-link-color': config.variant === 'buttons' ? '#fff' : 'inherit',
  } as React.CSSProperties;

  return (
    <nav className={styles.widget} style={customProps}>
      {loading && <p>Loading navigation…</p>}
      {error && <p>{error}</p>}
      {!loading && menuItems.length > 0 && renderMenuItems(menuItems)}
    </nav>
  );
}
