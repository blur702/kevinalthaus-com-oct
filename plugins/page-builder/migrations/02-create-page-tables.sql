-- ============================================================================
-- Page Builder Plugin - Page Tables
-- Migration: 02-create-page-tables.sql
-- Description: Create pages and page_versions tables with JSONB storage,
--              constraints, indexes, and triggers for production use
-- ============================================================================

SET search_path TO plugin_page_builder, public;

-- ============================================================================
-- MAIN PAGES TABLE
-- ============================================================================

-- Core pages table with JSONB for flexible layouts
CREATE TABLE IF NOT EXISTS plugin_page_builder.pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL CHECK (length(title) > 0 AND length(title) <= 500),
  slug VARCHAR(500) NOT NULL CHECK (length(slug) > 0 AND length(slug) <= 500),
  layout_json JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(layout_json) = 'object'),
  meta_description VARCHAR(160) CHECK (meta_description IS NULL OR length(meta_description) <= 160),
  meta_keywords TEXT,
  status plugin_page_builder.page_status NOT NULL DEFAULT 'draft',
  publish_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT check_published_at_after_created CHECK (
    published_at IS NULL OR published_at >= created_at
  )
);

-- ============================================================================
-- PAGE VERSIONS TABLE
-- ============================================================================

-- Historical versions for audit trail and rollback
CREATE TABLE IF NOT EXISTS plugin_page_builder.page_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES plugin_page_builder.pages(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) NOT NULL,
  layout_json JSONB NOT NULL,
  status plugin_page_builder.page_status NOT NULL,
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT unique_page_version UNIQUE (page_id, version_number)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Unique slug constraint (excluding soft deletes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pages_slug_unique
  ON plugin_page_builder.pages (slug)
  WHERE deleted_at IS NULL;

-- Performance indexes for common queries
CREATE INDEX IF NOT EXISTS idx_pages_status
  ON plugin_page_builder.pages (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pages_slug
  ON plugin_page_builder.pages (slug)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pages_created_by
  ON plugin_page_builder.pages (created_by);

CREATE INDEX IF NOT EXISTS idx_pages_publish_at
  ON plugin_page_builder.pages (publish_at)
  WHERE status = 'scheduled' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pages_published_at
  ON plugin_page_builder.pages (published_at DESC)
  WHERE status = 'published' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pages_deleted_at
  ON plugin_page_builder.pages (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- GIN index for JSONB queries (widget searches, layout analysis)
CREATE INDEX IF NOT EXISTS idx_pages_layout_json
  ON plugin_page_builder.pages USING GIN (layout_json);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_pages_search
  ON plugin_page_builder.pages
  USING GIN (to_tsvector('english', title || ' ' || COALESCE(meta_description, '') || ' ' || layout_json::text));

-- Version indexes
CREATE INDEX IF NOT EXISTS idx_page_versions_page_id
  ON plugin_page_builder.page_versions (page_id);

CREATE INDEX IF NOT EXISTS idx_page_versions_version
  ON plugin_page_builder.page_versions (page_id, version_number DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION plugin_page_builder.update_page_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_page_timestamp
  BEFORE UPDATE ON plugin_page_builder.pages
  FOR EACH ROW
  EXECUTE FUNCTION plugin_page_builder.update_page_timestamp();

-- Create version snapshot on significant changes
CREATE OR REPLACE FUNCTION plugin_page_builder.create_page_version()
RETURNS TRIGGER AS $$
DECLARE
  next_version INTEGER;
BEGIN
  -- Only create version if significant fields changed
  IF (
    OLD.layout_json::text IS DISTINCT FROM NEW.layout_json::text OR
    OLD.title IS DISTINCT FROM NEW.title OR
    OLD.slug IS DISTINCT FROM NEW.slug OR
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.meta_description IS DISTINCT FROM NEW.meta_description
  ) THEN
    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO next_version
    FROM plugin_page_builder.page_versions
    WHERE page_id = OLD.id;

    -- Insert version snapshot
    INSERT INTO plugin_page_builder.page_versions (
      page_id,
      version_number,
      title,
      slug,
      layout_json,
      status,
      change_summary,
      created_by
    ) VALUES (
      OLD.id,
      next_version,
      OLD.title,
      OLD.slug,
      OLD.layout_json,
      OLD.status,
      'Auto-version on update',
      COALESCE(NEW.updated_by, OLD.created_by)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_page_version
  BEFORE UPDATE ON plugin_page_builder.pages
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.deleted_at IS DISTINCT FROM NEW.deleted_at OR
    OLD.layout_json IS DISTINCT FROM NEW.layout_json
  )
  EXECUTE FUNCTION plugin_page_builder.create_page_version();

-- ============================================================================
-- MIGRATION TRACKING
-- ============================================================================

INSERT INTO plugin_page_builder.plugin_migrations (migration_name, description)
VALUES ('02-create-page-tables', 'Pages and versions tables with JSONB, constraints, indexes, and triggers')
ON CONFLICT (migration_name) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE plugin_page_builder.pages IS 'Main pages table with JSONB layout storage for flexible widget composition';
COMMENT ON TABLE plugin_page_builder.page_versions IS 'Historical versions for audit trail and rollback capability';
COMMENT ON COLUMN plugin_page_builder.pages.layout_json IS 'JSONB storage for PageLayout structure with grid and widgets';
COMMENT ON COLUMN plugin_page_builder.pages.slug IS 'URL-friendly identifier, unique among non-deleted pages';
COMMENT ON COLUMN plugin_page_builder.pages.status IS 'Publication workflow state (draft, published, scheduled, archived)';
COMMENT ON FUNCTION plugin_page_builder.update_page_timestamp() IS 'Auto-updates updated_at timestamp on row modification';
COMMENT ON FUNCTION plugin_page_builder.create_page_version() IS 'Creates version snapshot when significant fields change';
