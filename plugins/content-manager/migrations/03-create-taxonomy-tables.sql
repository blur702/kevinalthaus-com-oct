SET search_path TO plugin_content_manager, public;

-- Categories table (hierarchical)
CREATE TABLE IF NOT EXISTS plugin_content_manager.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  parent_id UUID,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL,
  updated_by UUID,

  -- Constraints
  CONSTRAINT categories_slug_unique UNIQUE (slug),
  CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES plugin_content_manager.categories(id) ON DELETE CASCADE,
  CONSTRAINT categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT categories_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT categories_no_self_reference CHECK (id != parent_id)
);

-- Tags table (flat)
CREATE TABLE IF NOT EXISTS plugin_content_manager.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL,

  -- Constraints
  CONSTRAINT tags_slug_unique UNIQUE (slug),
  CONSTRAINT tags_name_unique UNIQUE (name),
  CONSTRAINT tags_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT
);

-- Content-Categories junction table (many-to-many)
CREATE TABLE IF NOT EXISTS plugin_content_manager.content_categories (
  content_id UUID NOT NULL,
  category_id UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  PRIMARY KEY (content_id, category_id),
  CONSTRAINT content_categories_content_id_fkey FOREIGN KEY (content_id) REFERENCES plugin_content_manager.content(id) ON DELETE CASCADE,
  CONSTRAINT content_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES plugin_content_manager.categories(id) ON DELETE CASCADE
);

-- Content-Tags junction table (many-to-many)
CREATE TABLE IF NOT EXISTS plugin_content_manager.content_tags (
  content_id UUID NOT NULL,
  tag_id UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  PRIMARY KEY (content_id, tag_id),
  CONSTRAINT content_tags_content_id_fkey FOREIGN KEY (content_id) REFERENCES plugin_content_manager.content(id) ON DELETE CASCADE,
  CONSTRAINT content_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES plugin_content_manager.tags(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON plugin_content_manager.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON plugin_content_manager.categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_display_order ON plugin_content_manager.categories(parent_id, display_order);

CREATE INDEX IF NOT EXISTS idx_tags_slug ON plugin_content_manager.tags(slug);
CREATE INDEX IF NOT EXISTS idx_tags_name ON plugin_content_manager.tags(name);

CREATE INDEX IF NOT EXISTS idx_content_categories_category ON plugin_content_manager.content_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_content_tags_tag ON plugin_content_manager.content_tags(tag_id);

-- Auto-update timestamp trigger for categories
CREATE TRIGGER trigger_update_categories_timestamp
  BEFORE UPDATE ON plugin_content_manager.categories
  FOR EACH ROW
  EXECUTE FUNCTION plugin_content_manager.update_content_timestamp();

-- Function to get all parent categories (for hierarchy traversal)
CREATE OR REPLACE FUNCTION plugin_content_manager.get_category_parents(category_uuid UUID)
RETURNS TABLE (id UUID, name VARCHAR, slug VARCHAR, parent_id UUID, level INTEGER) AS $$
  WITH RECURSIVE category_tree AS (
    -- Base case: start with the given category
    SELECT c.id, c.name, c.slug, c.parent_id, 0 AS level
    FROM plugin_content_manager.categories c
    WHERE c.id = category_uuid

    UNION ALL

    -- Recursive case: get parent categories
    SELECT c.id, c.name, c.slug, c.parent_id, ct.level + 1
    FROM plugin_content_manager.categories c
    INNER JOIN category_tree ct ON c.id = ct.parent_id
  )
  SELECT * FROM category_tree ORDER BY level DESC;
$$ LANGUAGE SQL STABLE;

-- Function to get all child categories (for deletion checks)
CREATE OR REPLACE FUNCTION plugin_content_manager.get_category_children(category_uuid UUID)
RETURNS TABLE (id UUID, name VARCHAR, slug VARCHAR, parent_id UUID, level INTEGER) AS $$
  WITH RECURSIVE category_tree AS (
    -- Base case: start with the given category
    SELECT c.id, c.name, c.slug, c.parent_id, 0 AS level
    FROM plugin_content_manager.categories c
    WHERE c.id = category_uuid

    UNION ALL

    -- Recursive case: get child categories
    SELECT c.id, c.name, c.slug, c.parent_id, ct.level + 1
    FROM plugin_content_manager.categories c
    INNER JOIN category_tree ct ON c.parent_id = ct.id
  )
  SELECT * FROM category_tree ORDER BY level;
$$ LANGUAGE SQL STABLE;

-- Track migration
INSERT INTO plugin_content_manager.plugin_migrations (migration_name, description)
VALUES ('03-create-taxonomy-tables', 'Create categories and tags tables with relationships')
ON CONFLICT (migration_name) DO NOTHING;
