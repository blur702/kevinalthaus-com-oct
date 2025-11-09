-- ============================================================================
-- Page Builder Plugin - Template Tables
-- Migration: 03-create-template-tables.sql
-- Description: Create templates table for reusable page layouts with
--              validation, indexes, and triggers
-- ============================================================================

SET search_path TO plugin_page_builder, public;

-- ============================================================================
-- TEMPLATES TABLE
-- ============================================================================

-- Reusable page layout templates
CREATE TABLE IF NOT EXISTS plugin_page_builder.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL CHECK (length(name) > 0 AND length(name) <= 255),
  description TEXT CHECK (description IS NULL OR length(description) <= 1000),
  thumbnail_url VARCHAR(500) CHECK (
    thumbnail_url IS NULL OR
    thumbnail_url ~ '^https?://'
  ),
  layout_json JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(layout_json) = 'object'),
  category VARCHAR(100),
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Performance indexes for filtering and searching
CREATE INDEX IF NOT EXISTS idx_templates_category
  ON plugin_page_builder.templates (category)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_templates_is_public
  ON plugin_page_builder.templates (is_public)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_templates_created_by
  ON plugin_page_builder.templates (created_by);

CREATE INDEX IF NOT EXISTS idx_templates_deleted_at
  ON plugin_page_builder.templates (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- GIN index for JSONB layout queries
CREATE INDEX IF NOT EXISTS idx_templates_layout_json
  ON plugin_page_builder.templates USING GIN (layout_json);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION plugin_page_builder.update_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_template_timestamp
  BEFORE UPDATE ON plugin_page_builder.templates
  FOR EACH ROW
  EXECUTE FUNCTION plugin_page_builder.update_template_timestamp();

-- ============================================================================
-- MIGRATION TRACKING
-- ============================================================================

INSERT INTO plugin_page_builder.plugin_migrations (migration_name, description)
VALUES ('03-create-template-tables', 'Templates table for saved layouts with JSONB and constraints')
ON CONFLICT (migration_name) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE plugin_page_builder.templates IS 'Reusable page layout templates for consistent design across pages';
COMMENT ON COLUMN plugin_page_builder.templates.layout_json IS 'Complete PageLayout structure that can be cloned to new pages';
COMMENT ON COLUMN plugin_page_builder.templates.thumbnail_url IS 'Preview image URL (must be http/https)';
COMMENT ON COLUMN plugin_page_builder.templates.is_public IS 'Whether template is available to all users or private to creator';
COMMENT ON COLUMN plugin_page_builder.templates.category IS 'Optional grouping for template organization (e.g., "Landing Page", "Blog Post")';
COMMENT ON FUNCTION plugin_page_builder.update_template_timestamp() IS 'Auto-updates updated_at timestamp on template modification';
