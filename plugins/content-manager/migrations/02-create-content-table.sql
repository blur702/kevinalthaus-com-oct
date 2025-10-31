SET search_path TO plugin_content_manager, public;

-- Main content table
CREATE TABLE IF NOT EXISTS plugin_content_manager.content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) NOT NULL,
  body_html TEXT NOT NULL DEFAULT '',
  excerpt TEXT,
  meta_description VARCHAR(160),
  meta_keywords TEXT,
  featured_image_id UUID,
  status plugin_content_manager.content_status NOT NULL DEFAULT 'draft',
  publish_at TIMESTAMP,
  published_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL,
  updated_by UUID,
  deleted_at TIMESTAMP,
  deleted_by UUID,

  -- Constraints
  CONSTRAINT content_slug_unique UNIQUE (slug),
  CONSTRAINT content_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT content_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT content_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id) ON DELETE SET NULL
);

-- Content version history table
CREATE TABLE IF NOT EXISTS plugin_content_manager.content_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) NOT NULL,
  body_html TEXT NOT NULL,
  excerpt TEXT,
  meta_description VARCHAR(160),
  meta_keywords TEXT,
  status plugin_content_manager.content_status NOT NULL,
  change_summary TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL,

  -- Constraints
  CONSTRAINT content_versions_content_id_fkey FOREIGN KEY (content_id) REFERENCES plugin_content_manager.content(id) ON DELETE CASCADE,
  CONSTRAINT content_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT content_versions_content_version_unique UNIQUE (content_id, version_number)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_status ON plugin_content_manager.content(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_content_slug ON plugin_content_manager.content(slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_content_created_by ON plugin_content_manager.content(created_by);
CREATE INDEX IF NOT EXISTS idx_content_publish_at ON plugin_content_manager.content(publish_at) WHERE status = 'scheduled' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_content_published_at ON plugin_content_manager.content(published_at DESC) WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_content_deleted_at ON plugin_content_manager.content(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_search ON plugin_content_manager.content USING GIN(to_tsvector('english', title || ' ' || COALESCE(excerpt, '') || ' ' || body_html));

CREATE INDEX IF NOT EXISTS idx_content_versions_content_id ON plugin_content_manager.content_versions(content_id);
CREATE INDEX IF NOT EXISTS idx_content_versions_version ON plugin_content_manager.content_versions(content_id, version_number DESC);

-- Auto-update timestamp trigger function
CREATE OR REPLACE FUNCTION plugin_content_manager.update_content_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to content table
CREATE TRIGGER trigger_update_content_timestamp
  BEFORE UPDATE ON plugin_content_manager.content
  FOR EACH ROW
  EXECUTE FUNCTION plugin_content_manager.update_content_timestamp();

-- Function to create content version on update
CREATE OR REPLACE FUNCTION plugin_content_manager.create_content_version()
RETURNS TRIGGER AS $$
DECLARE
  next_version INTEGER;
BEGIN
  -- Only create version if content has actually changed
  IF (OLD.title IS DISTINCT FROM NEW.title OR
      OLD.slug IS DISTINCT FROM NEW.slug OR
      OLD.body_html IS DISTINCT FROM NEW.body_html OR
      OLD.excerpt IS DISTINCT FROM NEW.excerpt OR
      OLD.meta_description IS DISTINCT FROM NEW.meta_description OR
      OLD.meta_keywords IS DISTINCT FROM NEW.meta_keywords OR
      OLD.status IS DISTINCT FROM NEW.status) THEN

    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
    FROM plugin_content_manager.content_versions
    WHERE content_id = OLD.id;

    -- Insert version record
    INSERT INTO plugin_content_manager.content_versions (
      content_id,
      version_number,
      title,
      slug,
      body_html,
      excerpt,
      meta_description,
      meta_keywords,
      status,
      created_by
    ) VALUES (
      OLD.id,
      next_version,
      OLD.title,
      OLD.slug,
      OLD.body_html,
      OLD.excerpt,
      OLD.meta_description,
      OLD.meta_keywords,
      OLD.status,
      COALESCE(NEW.updated_by, OLD.created_by)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply version creation trigger
CREATE TRIGGER trigger_create_content_version
  BEFORE UPDATE ON plugin_content_manager.content
  FOR EACH ROW
  EXECUTE FUNCTION plugin_content_manager.create_content_version();

-- Track migration
INSERT INTO plugin_content_manager.plugin_migrations (migration_name, description)
VALUES ('02-create-content-table', 'Create content and version history tables')
ON CONFLICT (migration_name) DO NOTHING;
