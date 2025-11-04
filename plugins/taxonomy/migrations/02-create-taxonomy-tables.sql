SET search_path TO plugin_taxonomy, public;

-- Categories table (hierarchical, namespaced for multi-plugin use)
CREATE TABLE IF NOT EXISTS plugin_taxonomy.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace VARCHAR(100) NOT NULL, -- Plugin namespace (e.g., 'content-manager', 'blog', 'products')
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  parent_id UUID,
  display_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}', -- Extensible metadata for plugin-specific data
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL,
  updated_by UUID,

  -- Constraints
  CONSTRAINT categories_namespace_slug_unique UNIQUE (namespace, slug),
  CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES plugin_taxonomy.categories(id) ON DELETE CASCADE,
  CONSTRAINT categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT categories_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT categories_no_self_reference CHECK (id != parent_id)
);

-- Tags table (flat, namespaced for multi-plugin use)
CREATE TABLE IF NOT EXISTS plugin_taxonomy.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace VARCHAR(100) NOT NULL, -- Plugin namespace
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  metadata JSONB DEFAULT '{}', -- Extensible metadata
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL,

  -- Constraints
  CONSTRAINT tags_namespace_slug_unique UNIQUE (namespace, slug),
  CONSTRAINT tags_namespace_name_unique UNIQUE (namespace, name),
  CONSTRAINT tags_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT
);

-- Generic entity-category relationships (many-to-many)
-- This allows any plugin to associate their entities with categories
CREATE TABLE IF NOT EXISTS plugin_taxonomy.entity_categories (
  namespace VARCHAR(100) NOT NULL, -- Plugin namespace
  entity_id UUID NOT NULL, -- ID of the entity (content, product, etc.)
  category_id UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  PRIMARY KEY (namespace, entity_id, category_id),
  CONSTRAINT entity_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES plugin_taxonomy.categories(id) ON DELETE CASCADE
);

-- Generic entity-tag relationships (many-to-many)
CREATE TABLE IF NOT EXISTS plugin_taxonomy.entity_tags (
  namespace VARCHAR(100) NOT NULL, -- Plugin namespace
  entity_id UUID NOT NULL, -- ID of the entity
  tag_id UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  PRIMARY KEY (namespace, entity_id, tag_id),
  CONSTRAINT entity_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES plugin_taxonomy.tags(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_categories_namespace ON plugin_taxonomy.categories(namespace);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON plugin_taxonomy.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON plugin_taxonomy.categories(namespace, slug);
CREATE INDEX IF NOT EXISTS idx_categories_display_order ON plugin_taxonomy.categories(parent_id, display_order);

CREATE INDEX IF NOT EXISTS idx_tags_namespace ON plugin_taxonomy.tags(namespace);
CREATE INDEX IF NOT EXISTS idx_tags_slug ON plugin_taxonomy.tags(namespace, slug);
CREATE INDEX IF NOT EXISTS idx_tags_name ON plugin_taxonomy.tags(namespace, name);

CREATE INDEX IF NOT EXISTS idx_entity_categories_category ON plugin_taxonomy.entity_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_entity_categories_entity ON plugin_taxonomy.entity_categories(namespace, entity_id);

CREATE INDEX IF NOT EXISTS idx_entity_tags_tag ON plugin_taxonomy.entity_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_entity_tags_entity ON plugin_taxonomy.entity_tags(namespace, entity_id);

-- Auto-update timestamp trigger function
CREATE OR REPLACE FUNCTION plugin_taxonomy.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to categories table
CREATE TRIGGER trigger_update_categories_timestamp
  BEFORE UPDATE ON plugin_taxonomy.categories
  FOR EACH ROW
  EXECUTE FUNCTION plugin_taxonomy.update_timestamp();

-- Function to get all parent categories (for hierarchy traversal)
CREATE OR REPLACE FUNCTION plugin_taxonomy.get_category_parents(category_uuid UUID)
RETURNS TABLE (id UUID, namespace VARCHAR, name VARCHAR, slug VARCHAR, parent_id UUID, level INTEGER) AS $$
  WITH RECURSIVE category_tree AS (
    -- Base case: start with the given category
    SELECT c.id, c.namespace, c.name, c.slug, c.parent_id, 0 AS level
    FROM plugin_taxonomy.categories c
    WHERE c.id = category_uuid

    UNION ALL

    -- Recursive case: get parent categories
    SELECT c.id, c.namespace, c.name, c.slug, c.parent_id, ct.level + 1
    FROM plugin_taxonomy.categories c
    INNER JOIN category_tree ct ON c.id = ct.parent_id
  )
  SELECT * FROM category_tree ORDER BY level DESC;
$$ LANGUAGE SQL STABLE;

-- Function to get all child categories (for deletion checks)
CREATE OR REPLACE FUNCTION plugin_taxonomy.get_category_children(category_uuid UUID)
RETURNS TABLE (id UUID, namespace VARCHAR, name VARCHAR, slug VARCHAR, parent_id UUID, level INTEGER) AS $$
  WITH RECURSIVE category_tree AS (
    -- Base case: start with the given category
    SELECT c.id, c.namespace, c.name, c.slug, c.parent_id, 0 AS level
    FROM plugin_taxonomy.categories c
    WHERE c.id = category_uuid

    UNION ALL

    -- Recursive case: get child categories
    SELECT c.id, c.namespace, c.name, c.slug, c.parent_id, ct.level + 1
    FROM plugin_taxonomy.categories c
    INNER JOIN category_tree ct ON c.parent_id = ct.id
  )
  SELECT * FROM category_tree ORDER BY level;
$$ LANGUAGE SQL STABLE;

-- Track migration
INSERT INTO plugin_taxonomy.plugin_migrations (migration_name, description)
VALUES ('02-create-taxonomy-tables', 'Create namespaced categories and tags tables with relationships')
ON CONFLICT (migration_name) DO NOTHING;
