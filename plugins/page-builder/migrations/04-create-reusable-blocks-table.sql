-- ============================================================================
-- Page Builder Plugin - Reusable Blocks Table
-- Migration: 04-create-reusable-blocks-table.sql
-- Description: Create reusable_blocks table for widget groups with JSONB
--              storage, validation, and indexes
-- ============================================================================

SET search_path TO plugin_page_builder, public;

-- ============================================================================
-- REUSABLE BLOCKS TABLE
-- ============================================================================

-- Reusable widget or widget groups
CREATE TABLE IF NOT EXISTS plugin_page_builder.reusable_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL CHECK (length(name) > 0 AND length(name) <= 255),
  description TEXT CHECK (description IS NULL OR length(description) <= 1000),
  thumbnail_url VARCHAR(500) CHECK (
    thumbnail_url IS NULL OR
    thumbnail_url ~ '^https?://'
  ),
  block_json JSONB NOT NULL CHECK (
    jsonb_typeof(block_json) IN ('object', 'array')
  ),
  category VARCHAR(100),
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
CREATE INDEX IF NOT EXISTS idx_reusable_blocks_category
  ON plugin_page_builder.reusable_blocks (category)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reusable_blocks_created_by
  ON plugin_page_builder.reusable_blocks (created_by);

CREATE INDEX IF NOT EXISTS idx_reusable_blocks_deleted_at
  ON plugin_page_builder.reusable_blocks (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- GIN index for JSONB block queries
CREATE INDEX IF NOT EXISTS idx_reusable_blocks_block_json
  ON plugin_page_builder.reusable_blocks USING GIN (block_json);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION plugin_page_builder.update_reusable_block_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reusable_block_timestamp
  BEFORE UPDATE ON plugin_page_builder.reusable_blocks
  FOR EACH ROW
  EXECUTE FUNCTION plugin_page_builder.update_reusable_block_timestamp();

-- ============================================================================
-- MIGRATION TRACKING
-- ============================================================================

INSERT INTO plugin_page_builder.plugin_migrations (migration_name, description)
VALUES ('04-create-reusable-blocks-table', 'Reusable blocks table for widget groups with JSONB')
ON CONFLICT (migration_name) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE plugin_page_builder.reusable_blocks IS 'Reusable widget or widget groups that can be inserted into pages';
COMMENT ON COLUMN plugin_page_builder.reusable_blocks.block_json IS 'Single WidgetConfig (object) or array of WidgetConfig for widget groups';
COMMENT ON COLUMN plugin_page_builder.reusable_blocks.thumbnail_url IS 'Preview image URL (must be http/https)';
COMMENT ON COLUMN plugin_page_builder.reusable_blocks.category IS 'Optional grouping for block organization (e.g., "Headers", "Footers", "CTAs")';
COMMENT ON FUNCTION plugin_page_builder.update_reusable_block_timestamp() IS 'Auto-updates updated_at timestamp on block modification';
