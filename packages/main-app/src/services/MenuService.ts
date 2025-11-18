import type { Pool, PoolClient } from 'pg';
import type {
  CreateMenuItemRequest,
  CreateMenuRequest,
  Menu,
  MenuItem,
  MenuLocation,
  MenuWithItems,
  UpdateMenuItemRequest,
  UpdateMenuRequest,
} from '@monorepo/shared';
import type { Role } from '@monorepo/shared';

interface MenuRow extends Omit<Menu, 'metadata'> {
  metadata: Record<string, unknown> | null;
}

interface MenuItemRow extends Omit<MenuItem, 'metadata' | 'visibility_roles' | 'children'> {
  metadata: Record<string, unknown> | null;
  visibility_roles: string[] | null;
}

interface ListOptions {
  includeItems?: boolean;
  activeOnly?: boolean;
}

interface ItemQueryOptions {
  activeOnly?: boolean;
}

export class MenuService {
  constructor(private readonly db: Pool) {}

  private mapMenu(row: MenuRow): Menu {
    return {
      ...row,
      metadata: row.metadata ?? {},
    };
  }

  private mapMenuItem(row: MenuItemRow): MenuItem {
    return {
      ...row,
      metadata: row.metadata ?? {},
      visibility_roles: (row.visibility_roles ?? []) as Role[],
      children: [],
    };
  }

  private async fetchMenuItems(menuIds: string[], options: ItemQueryOptions = {}): Promise<MenuItem[]> {
    if (menuIds.length === 0) {
      return [];
    }

    const params: Array<string | boolean | string[]> = [menuIds];
    let clause = '';
    if (options.activeOnly) {
      clause = 'AND mi.is_active = true';
    }

    const { rows } = await this.db.query<MenuItemRow>(
      `
      SELECT mi.*
      FROM menu_items mi
      WHERE mi.menu_id = ANY($1::uuid[])
      ${clause}
      ORDER BY mi.menu_id, mi.parent_id NULLS FIRST, mi.order_index ASC, mi.created_at ASC
      `,
      params as any[]
    );

    const items = rows.map((row) => this.mapMenuItem(row));

    // Validate items and throw error if any invalid items are detected
    const invalidItems: Array<{ id: string; menu_id: string; label: string; parent_id: string | null }> = [];

    for (const item of items) {
      if (!this.validateMenuItem(item)) {
        invalidItems.push({
          id: item.id,
          menu_id: item.menu_id,
          label: item.label,
          parent_id: item.parent_id
        });
        // eslint-disable-next-line no-console
        console.error('[MenuService] Invalid menu item detected:', {
          id: item.id,
          menu_id: item.menu_id,
          label: item.label,
          parent_id: item.parent_id
        });
      }
    }

    if (invalidItems.length > 0) {
      // eslint-disable-next-line no-console
      console.error(`[MenuService] Found ${invalidItems.length} invalid menu items with missing or invalid IDs`);
      throw new Error(
        `Database contains ${invalidItems.length} invalid menu item(s) with missing or undefined IDs. ` +
        `Please run database integrity checks. Invalid items: ${invalidItems.map(i => i.label).join(', ')}`
      );
    }

    return items;
  }

  private buildTree(items: MenuItem[]): MenuItem[] {
    // Assume items have been pre-validated by fetchMenuItems()
    // This method focuses solely on building the hierarchical structure
    const byId = new Map<string, MenuItem>();
    items.forEach((item) => {
      byId.set(item.id, item);
      item.children = [];
    });

    const roots: MenuItem[] = [];
    items.forEach((item) => {
      if (item.parent_id && byId.has(item.parent_id)) {
        const parent = byId.get(item.parent_id)!;
        parent.children!.push(item);
      } else {
        roots.push(item);
      }
    });

    const sortRecursive = (nodes: MenuItem[]) => {
      nodes.sort((a, b) => {
        if (a.order_index === b.order_index) {
          return a.label.localeCompare(b.label);
        }
        return a.order_index - b.order_index;
      });
      nodes.forEach((child) => {
        if (child.children && child.children.length > 0) {
          sortRecursive(child.children);
        }
      });
    };

    sortRecursive(roots);
    return roots;
  }

  async listMenus(options: ListOptions = {}): Promise<MenuWithItems[]> {
    const { includeItems = true, activeOnly = false } = options;
    const condition = activeOnly ? 'WHERE is_active = true' : '';

    const { rows } = await this.db.query<MenuRow>(
      `SELECT * FROM menus ${condition} ORDER BY location, name`
    );
    const menus = rows.map((row) => this.mapMenu(row));

    if (!includeItems || menus.length === 0) {
      return menus.map((menu) => ({ ...menu, items: [] }));
    }

    const items = await this.fetchMenuItems(
      menus.map((menu) => menu.id),
      { activeOnly }
    );

    const grouped = new Map<string, MenuItem[]>();
    items.forEach((item) => {
      if (!grouped.has(item.menu_id)) {
        grouped.set(item.menu_id, []);
      }
      grouped.get(item.menu_id)!.push(item);
    });

    return menus.map((menu) => ({
      ...menu,
      items: this.buildTree(grouped.get(menu.id) ?? []),
    }));
  }

  async getMenuById(id: string, options: ListOptions = {}): Promise<MenuWithItems | null> {
    const { rows } = await this.db.query<MenuRow>('SELECT * FROM menus WHERE id = $1', [id]);
    if (rows.length === 0) {
      return null;
    }
    const menu = this.mapMenu(rows[0]);
    if (options.includeItems === false) {
      return { ...menu, items: [] };
    }
    const items = await this.fetchMenuItems([menu.id], { activeOnly: options.activeOnly });
    return {
      ...menu,
      items: this.buildTree(items.filter((item) => item.menu_id === menu.id)),
    };
  }

  async getMenuBySlug(slug: string, options: ListOptions = {}): Promise<MenuWithItems | null> {
    const { rows } = await this.db.query<MenuRow>('SELECT * FROM menus WHERE slug = $1', [slug]);
    if (rows.length === 0) {
      return null;
    }
    const menu = this.mapMenu(rows[0]);
    if (options.includeItems === false) {
      return { ...menu, items: [] };
    }
    const items = await this.fetchMenuItems([menu.id], { activeOnly: options.activeOnly });
    return {
      ...menu,
      items: this.buildTree(items.filter((item) => item.menu_id === menu.id)),
    };
  }

  async createMenu(data: CreateMenuRequest, userId: string): Promise<Menu> {
    const slug = this.slugify(data.slug || data.name);
    const location: MenuLocation = data.location ?? 'custom';

    const { rows } = await this.db.query<MenuRow>(
      `
      INSERT INTO menus (name, slug, description, location, is_active, metadata, created_by, updated_by)
      VALUES ($1, $2, $3, $4, COALESCE($5, true), COALESCE($6::jsonb, '{}'::jsonb), $7, $7)
      RETURNING *
      `,
      [
        data.name.trim(),
        slug,
        data.description ?? null,
        location,
        data.is_active ?? true,
        JSON.stringify(data.metadata ?? {}),
        userId,
      ]
    );

    return this.mapMenu(rows[0]);
  }

  async updateMenu(id: string, data: UpdateMenuRequest, userId: string): Promise<Menu> {
    const existing = await this.getMenuById(id, { includeItems: false });
    if (!existing) {
      throw new Error('Menu not found');
    }

    const slug = data.slug ? this.slugify(data.slug) : existing.slug;
    const {
      rows,
    } = await this.db.query<MenuRow>(
      `
      UPDATE menus
      SET
        name = COALESCE($1, name),
        slug = $2,
        description = $3,
        location = COALESCE($4, location),
        is_active = COALESCE($5, is_active),
        metadata = COALESCE($6::jsonb, metadata),
        updated_at = CURRENT_TIMESTAMP,
        updated_by = $7
      WHERE id = $8
      RETURNING *
      `,
      [
        data.name ?? null,
        slug,
        data.description ?? existing.description ?? null,
        data.location ?? null,
        data.is_active ?? null,
        data.metadata ? JSON.stringify(data.metadata) : null,
        userId,
        id,
      ]
    );

    return this.mapMenu(rows[0]);
  }

  async deleteMenu(id: string): Promise<void> {
    await this.db.query('DELETE FROM menus WHERE id = $1', [id]);
  }

  async createMenuItem(menuId: string, data: CreateMenuItemRequest, userId: string): Promise<MenuItem> {
    await this.ensureMenuExists(menuId);
    await this.validateParent(menuId, data.parent_id ?? null);

    const orderIndex = await this.resolveOrderIndex(menuId, data.parent_id ?? null, data.order_index);
    const { rows } = await this.db.query<MenuItemRow>(
      `
      INSERT INTO menu_items (
        menu_id, parent_id, label, url, is_external, open_in_new_tab, icon, rel,
        order_index, is_active, metadata, visibility_roles, created_by, updated_by
      )
      VALUES (
        $1, $2, $3, $4, COALESCE($5, false), COALESCE($6, false), $7, $8,
        $9, COALESCE($10, true), COALESCE($11::jsonb, '{}'::jsonb), COALESCE($12::text[], '{}'),
        $13, $13
      )
      RETURNING *
      `,
      [
        menuId,
        data.parent_id ?? null,
        data.label.trim(),
        data.url.trim(),
        data.is_external ?? false,
        data.open_in_new_tab ?? false,
        data.icon ?? null,
        data.rel ?? null,
        orderIndex,
        data.is_active ?? true,
        JSON.stringify(data.metadata ?? {}),
        data.visibility_roles ?? [],
        userId,
      ]
    );

    return this.mapMenuItem(rows[0]);
  }

  async updateMenuItem(id: string, data: UpdateMenuItemRequest, userId: string): Promise<MenuItem> {
    const { rows } = await this.db.query<MenuItemRow>('SELECT * FROM menu_items WHERE id = $1', [id]);
    if (rows.length === 0) {
      throw new Error('Menu item not found');
    }

    const existing = this.mapMenuItem(rows[0]);
    const parentId = data.parent_id === undefined ? existing.parent_id ?? null : data.parent_id;

    if (parentId === existing.id) {
      throw new Error('Item cannot be its own parent');
    }

    await this.validateParent(existing.menu_id, parentId, existing.id);

    const orderIndex = await this.resolveOrderIndex(
      existing.menu_id,
      parentId,
      data.order_index ?? existing.order_index
    );

    const updated = await this.db.query<MenuItemRow>(
      `
      UPDATE menu_items
      SET
        parent_id = $1,
        label = COALESCE($2, label),
        url = COALESCE($3, url),
        is_external = COALESCE($4, is_external),
        open_in_new_tab = COALESCE($5, open_in_new_tab),
        icon = CASE WHEN $6 IS NULL THEN icon ELSE $6 END,
        rel = CASE WHEN $7 IS NULL THEN rel ELSE $7 END,
        order_index = $8,
        is_active = COALESCE($9, is_active),
        metadata = COALESCE($10::jsonb, metadata),
        visibility_roles = COALESCE($11::text[], visibility_roles),
        updated_at = CURRENT_TIMESTAMP,
        updated_by = $12
      WHERE id = $13
      RETURNING *
      `,
      [
        parentId,
        data.label ?? null,
        data.url ?? null,
        data.is_external ?? null,
        data.open_in_new_tab ?? null,
        data.icon === undefined ? existing.icon ?? null : data.icon,
        data.rel === undefined ? existing.rel ?? null : data.rel,
        orderIndex,
        data.is_active ?? null,
        data.metadata ? JSON.stringify(data.metadata) : null,
        data.visibility_roles ?? null,
        userId,
        id,
      ]
    );

    return this.mapMenuItem(updated.rows[0]);
  }

  async deleteMenuItem(id: string): Promise<void> {
    await this.db.query('DELETE FROM menu_items WHERE id = $1', [id]);
  }

  async getPublicMenuBySlug(slug: string): Promise<MenuWithItems | null> {
    const menu = await this.getMenuBySlug(slug, { includeItems: true, activeOnly: true });
    if (!menu || !menu.is_active) {
      return null;
    }
    return menu;
  }

  private slugify(input: string): string {
    return input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 120);
  }

  private async ensureMenuExists(menuId: string): Promise<void> {
    const { rowCount } = await this.db.query('SELECT 1 FROM menus WHERE id = $1', [menuId]);
    if (rowCount === 0) {
      throw new Error('Menu not found');
    }
  }

  private async validateParent(menuId: string, parentId: string | null, currentId?: string): Promise<void> {
    if (!parentId) {
      return;
    }
    if (currentId && parentId === currentId) {
      throw new Error('Item cannot be its own parent');
    }

    const { rows } = await this.db.query('SELECT menu_id FROM menu_items WHERE id = $1', [parentId]);
    if (rows.length === 0) {
      throw new Error('Parent item not found');
    }
    if (rows[0].menu_id !== menuId) {
      throw new Error('Parent item belongs to a different menu');
    }
  }

  private async resolveOrderIndex(menuId: string, parentId: string | null, requested?: number): Promise<number> {
    if (requested !== undefined && requested !== null) {
      return requested;
    }
    const { rows } = await this.db.query<{ max: number | null }>(
      `
      SELECT MAX(order_index)::int AS max
      FROM menu_items
      WHERE menu_id = $1
        AND (
          ($2::uuid IS NULL AND parent_id IS NULL)
          OR ($2::uuid IS NOT NULL AND parent_id = $2::uuid)
        )
      `,
      [menuId, parentId]
    );
    const max = rows[0]?.max ?? -10;
    return max + 10;
  }

  /**
   * Validates that a menu item has a valid ID
   * @param item - The menu item to validate
   * @returns true if the item has a valid ID, false otherwise
   */
  private validateMenuItem(item: MenuItem): boolean {
    return !!(item.id && item.id !== 'undefined' && item.id.trim() !== '');
  }

  async withTransaction<T>(handler: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const result = await handler(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
