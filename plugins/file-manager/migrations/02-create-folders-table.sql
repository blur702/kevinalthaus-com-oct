-- Migration: Create folders table with hierarchical structure
-- Description: Create folders table with self-referencing parent relationship and path management
-- Date: 2025-11-12

SET search_path TO plugin_file_manager, public;

-- =============================================================================
-- Table: plugin_file_manager.folders
-- Purpose: Hierarchical folder structure for organizing files
-- =============================================================================

CREATE TABLE IF NOT EXISTS plugin_file_manager.folders (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Folder identification
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,

  -- Hierarchical structure
  parent_id UUID REFERENCES plugin_file_manager.folders(id) ON DELETE CASCADE,
  folder_type plugin_file_manager.folder_type NOT NULL DEFAULT 'standard',
  path TEXT NOT NULL, -- Full path from root (e.g., '/Documents/Projects')
  depth INTEGER NOT NULL DEFAULT 0, -- Depth in hierarchy (0 for root)

  -- Visual customization
  color VARCHAR(7), -- Hex color code (e.g., '#FF5733')
  icon VARCHAR(50), -- Icon identifier

  -- System protection
  is_system BOOLEAN NOT NULL DEFAULT false, -- System folders cannot be deleted

  -- Audit trail
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Soft delete support
  deleted_at TIMESTAMP,
  deleted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT folders_parent_name_unique UNIQUE (parent_id, name)
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT folders_parent_slug_unique UNIQUE (parent_id, slug)
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT folders_depth_range CHECK (depth >= 0 AND depth <= 10),
  CONSTRAINT folders_name_not_empty CHECK (LENGTH(name) > 0),
  CONSTRAINT folders_color_format CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$')
);

-- Create partial unique indexes for soft delete support
CREATE UNIQUE INDEX idx_folders_parent_name_unique
  ON plugin_file_manager.folders(parent_id, name)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX idx_folders_parent_slug_unique
  ON plugin_file_manager.folders(parent_id, slug)
  WHERE deleted_at IS NULL;

-- =============================================================================
-- Indexes for plugin_file_manager.folders
-- =============================================================================

-- Query child folders
CREATE INDEX idx_folders_parent_id
  ON plugin_file_manager.folders(parent_id)
  WHERE deleted_at IS NULL;

-- Full-text search on path
CREATE INDEX idx_folders_path
  ON plugin_file_manager.folders USING GIN(to_tsvector('english', path))
  WHERE deleted_at IS NULL;

-- Query folders by creator
CREATE INDEX idx_folders_created_by
  ON plugin_file_manager.folders(created_by);

-- Query by slug
CREATE INDEX idx_folders_slug
  ON plugin_file_manager.folders(slug)
  WHERE deleted_at IS NULL;

-- Query deleted folders
CREATE INDEX idx_folders_deleted_at
  ON plugin_file_manager.folders(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Query by depth for hierarchy traversal
CREATE INDEX idx_folders_depth
  ON plugin_file_manager.folders(depth)
  WHERE deleted_at IS NULL;

-- =============================================================================
-- Triggers for automatic path and timestamp management
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION plugin_file_manager.update_folder_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_folders_updated_at
  BEFORE UPDATE ON plugin_file_manager.folders
  FOR EACH ROW
  EXECUTE FUNCTION plugin_file_manager.update_folder_updated_at();

-- Function to calculate path and depth
CREATE OR REPLACE FUNCTION plugin_file_manager.calculate_folder_path()
RETURNS TRIGGER AS $$
DECLARE
  parent_path TEXT;
  parent_depth INTEGER;
BEGIN
  IF NEW.parent_id IS NULL THEN
    -- Root folder
    NEW.path = '/' || NEW.name;
    NEW.depth = 0;
  ELSE
    -- Get parent path and depth
    SELECT path, depth INTO parent_path, parent_depth
    FROM plugin_file_manager.folders
    WHERE id = NEW.parent_id;

    IF parent_path IS NULL THEN
      RAISE EXCEPTION 'Parent folder does not exist: %', NEW.parent_id;
    END IF;

    -- Construct path and depth
    NEW.path = parent_path || '/' || NEW.name;
    NEW.depth = parent_depth + 1;

    -- Enforce max depth
    IF NEW.depth > 10 THEN
      RAISE EXCEPTION 'Maximum folder depth (10) exceeded';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate path and depth on insert or update
CREATE TRIGGER trigger_folders_calculate_path
  BEFORE INSERT OR UPDATE OF parent_id, name ON plugin_file_manager.folders
  FOR EACH ROW
  EXECUTE FUNCTION plugin_file_manager.calculate_folder_path();

-- =============================================================================
-- Comments for documentation
-- =============================================================================

COMMENT ON TABLE plugin_file_manager.folders IS 'Hierarchical folder structure for organizing files. Supports up to 10 levels of nesting.';
COMMENT ON COLUMN plugin_file_manager.folders.parent_id IS 'Reference to parent folder. NULL for root folders.';
COMMENT ON COLUMN plugin_file_manager.folders.path IS 'Full path from root, automatically calculated. Example: /Documents/Projects/2024';
COMMENT ON COLUMN plugin_file_manager.folders.depth IS 'Depth in hierarchy (0 for root), automatically calculated. Maximum depth is 10.';
COMMENT ON COLUMN plugin_file_manager.folders.is_system IS 'System folders are protected and cannot be deleted by users.';
COMMENT ON COLUMN plugin_file_manager.folders.color IS 'Optional hex color code for UI customization (e.g., #4A90E2).';
COMMENT ON COLUMN plugin_file_manager.folders.deleted_at IS 'Soft delete timestamp. NULL = active folder.';

-- Track this migration
INSERT INTO plugin_file_manager.plugin_migrations (migration_name, description)
VALUES ('02-create-folders-table', 'Create folders table with hierarchical structure and automatic path management')
ON CONFLICT (migration_name) DO NOTHING;
