-- Migration: Create file-folder junction table
-- Description: Many-to-many relationship between files and folders (tag-like behavior)
-- Date: 2025-11-12

SET search_path TO plugin_file_manager, public;

-- =============================================================================
-- Table: plugin_file_manager.file_folders
-- Purpose: Junction table linking files to folders (many-to-many)
-- =============================================================================

CREATE TABLE IF NOT EXISTS plugin_file_manager.file_folders (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationship columns
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  folder_id UUID NOT NULL REFERENCES plugin_file_manager.folders(id) ON DELETE CASCADE,

  -- Audit trail
  added_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Optional ordering within folder
  position INTEGER, -- NULL = no specific order, >= 0 = manual ordering

  -- Constraints
  CONSTRAINT file_folders_file_folder_unique UNIQUE (file_id, folder_id),
  CONSTRAINT file_folders_position_positive CHECK (position IS NULL OR position >= 0)
);

-- =============================================================================
-- Indexes for plugin_file_manager.file_folders
-- =============================================================================

-- Query folders containing a file (reverse lookup)
CREATE INDEX idx_file_folders_file_id
  ON plugin_file_manager.file_folders(file_id);

-- Query files in a folder (most common query)
CREATE INDEX idx_file_folders_folder_id
  ON plugin_file_manager.file_folders(folder_id);

-- Query associations by user
CREATE INDEX idx_file_folders_added_by
  ON plugin_file_manager.file_folders(added_by);

-- Support ordered file lists within folders
CREATE INDEX idx_file_folders_position
  ON plugin_file_manager.file_folders(folder_id, position)
  WHERE position IS NOT NULL;

-- Query by creation date for recent associations
CREATE INDEX idx_file_folders_added_at
  ON plugin_file_manager.file_folders(added_at DESC);

-- =============================================================================
-- Comments for documentation
-- =============================================================================

COMMENT ON TABLE plugin_file_manager.file_folders IS 'Many-to-many junction table linking files to folders. Files can exist in multiple folders (tag-like behavior) or in no folder (unorganized).';
COMMENT ON COLUMN plugin_file_manager.file_folders.file_id IS 'Reference to file in public.files table.';
COMMENT ON COLUMN plugin_file_manager.file_folders.folder_id IS 'Reference to folder in folders table.';
COMMENT ON COLUMN plugin_file_manager.file_folders.position IS 'Optional manual ordering within folder. NULL = no specific order, use added_at for sorting.';
COMMENT ON COLUMN plugin_file_manager.file_folders.added_by IS 'User who added the file to the folder.';

-- Track this migration
INSERT INTO plugin_file_manager.plugin_migrations (migration_name, description)
VALUES ('03-create-file-folders-junction', 'Create file-folder junction table for many-to-many relationships')
ON CONFLICT (migration_name) DO NOTHING;
