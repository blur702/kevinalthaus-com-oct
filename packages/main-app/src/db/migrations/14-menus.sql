-- Migration 14: Navigation Menus
-- Creates reusable menu + menu item tables for header/footer/navigation management

-- ============================================================================
-- Menus Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    location VARCHAR(32) NOT NULL DEFAULT 'custom',
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_menus_location CHECK (location IN ('header', 'footer', 'custom'))
);

CREATE INDEX IF NOT EXISTS idx_menus_location ON menus(location);
CREATE UNIQUE INDEX IF NOT EXISTS idx_menus_unique_location
    ON menus(location)
    WHERE location IN ('header', 'footer');

COMMENT ON TABLE menus IS 'Reusable navigation menus for header, footer, and custom placements';
COMMENT ON COLUMN menus.location IS 'Where the menu is rendered (header, footer, custom)';

-- ============================================================================
-- Menu Items Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
    label VARCHAR(150) NOT NULL,
    url TEXT NOT NULL,
    is_external BOOLEAN NOT NULL DEFAULT false,
    open_in_new_tab BOOLEAN NOT NULL DEFAULT false,
    icon VARCHAR(120),
    rel VARCHAR(120),
    order_index INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    visibility_roles TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_menu_items_url CHECK (trim(url) <> '')
);

CREATE INDEX IF NOT EXISTS idx_menu_items_menu_id ON menu_items(menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_parent_id ON menu_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_order ON menu_items(menu_id, parent_id, order_index);

COMMENT ON TABLE menu_items IS 'Hierarchical items for each menu';
COMMENT ON COLUMN menu_items.visibility_roles IS 'Optional list of roles allowed to see the item (empty = all)';

-- ============================================================================
-- Seed Default Header/Footer Menus (idempotent)
-- ============================================================================
DO $$
DECLARE
    admin_id UUID;
    header_menu_id UUID;
    footer_menu_id UUID;
BEGIN
    SELECT id INTO admin_id FROM users WHERE email = 'admin@kevinalthaus.com' LIMIT 1;
    IF admin_id IS NULL THEN
        SELECT id INTO admin_id FROM users ORDER BY created_at LIMIT 1;
    END IF;

    IF admin_id IS NULL THEN
        RAISE NOTICE 'No users found. Skipping menu seeding.';
        RETURN;
    END IF;

    INSERT INTO menus (name, slug, description, location, created_by)
    VALUES ('Main Navigation', 'main-navigation', 'Primary site navigation shown in the header', 'header', admin_id)
    ON CONFLICT (slug) DO NOTHING;

    INSERT INTO menus (name, slug, description, location, created_by)
    VALUES ('Footer Links', 'footer-links', 'Important links displayed in the global footer', 'footer', admin_id)
    ON CONFLICT (slug) DO NOTHING;

    SELECT id INTO header_menu_id FROM menus WHERE slug = 'main-navigation' LIMIT 1;
    SELECT id INTO footer_menu_id FROM menus WHERE slug = 'footer-links' LIMIT 1;

    -- Seed header items only if menu has no items yet
    IF header_menu_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM menu_items WHERE menu_id = header_menu_id) THEN
        INSERT INTO menu_items (menu_id, label, url, order_index, created_by)
        VALUES
            (header_menu_id, 'Home', '/', 0, admin_id),
            (header_menu_id, 'About', '/about', 10, admin_id),
            (header_menu_id, 'Contact', '/contact', 20, admin_id);
    END IF;

    -- Seed footer items only if menu has no items yet
    IF footer_menu_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM menu_items WHERE menu_id = footer_menu_id) THEN
        INSERT INTO menu_items (menu_id, label, url, order_index, created_by, is_external, open_in_new_tab, rel)
        VALUES
            (footer_menu_id, 'Privacy Policy', '/privacy', 0, admin_id, false, false, NULL),
            (footer_menu_id, 'Terms of Service', '/terms', 10, admin_id, false, false, NULL),
            (footer_menu_id, 'GitHub', 'https://github.com/kevinalthaus', 20, admin_id, true, true, 'noopener noreferrer');
    END IF;
END $$;

-- ============================================================================
-- Migration complete notice
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Migration 14: Navigation Menus';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Tables created: menus, menu_items';
    RAISE NOTICE 'Default menus seeded: header + footer';
END $$;
