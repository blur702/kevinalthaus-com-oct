-- Migration: Create file access log table
-- Description: Audit trail for all file and folder access for security and analytics
-- Date: 2025-11-12

SET search_path TO plugin_file_manager, public;

-- =============================================================================
-- Table: plugin_file_manager.file_access_log
-- Purpose: Audit trail and analytics for file/folder access
-- =============================================================================

CREATE TABLE IF NOT EXISTS plugin_file_manager.file_access_log (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Resource references (one of file_id or folder_id must be set)
  file_id UUID REFERENCES public.files(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES plugin_file_manager.folders(id) ON DELETE CASCADE,

  -- User context
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- NULL for anonymous access

  -- Action details
  action plugin_file_manager.access_action NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true, -- Whether action succeeded
  error_message TEXT, -- Error details if action failed

  -- Request metadata
  ip_address INET, -- IP address of the user
  user_agent TEXT, -- Browser/client user agent

  -- Additional context
  metadata JSONB, -- Flexible storage for additional context (e.g., download size, share recipient)

  -- Timestamp
  accessed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT file_access_log_resource_check CHECK (
    (file_id IS NOT NULL AND folder_id IS NULL) OR
    (file_id IS NULL AND folder_id IS NOT NULL)
  )
);

-- =============================================================================
-- Indexes for plugin_file_manager.file_access_log
-- =============================================================================

-- Query access logs for a file
CREATE INDEX idx_file_access_log_file_id
  ON plugin_file_manager.file_access_log(file_id)
  WHERE file_id IS NOT NULL;

-- Query access logs for a folder
CREATE INDEX idx_file_access_log_folder_id
  ON plugin_file_manager.file_access_log(folder_id)
  WHERE folder_id IS NOT NULL;

-- Query user's access history
CREATE INDEX idx_file_access_log_user_id
  ON plugin_file_manager.file_access_log(user_id)
  WHERE user_id IS NOT NULL;

-- Query recent access (for analytics and monitoring)
CREATE INDEX idx_file_access_log_accessed_at
  ON plugin_file_manager.file_access_log(accessed_at DESC);

-- Query by action type
CREATE INDEX idx_file_access_log_action
  ON plugin_file_manager.file_access_log(action);

-- Query by success/failure status
CREATE INDEX idx_file_access_log_success
  ON plugin_file_manager.file_access_log(success)
  WHERE success = false;

-- Query by metadata fields (JSONB GIN index for flexible queries)
CREATE INDEX idx_file_access_log_metadata
  ON plugin_file_manager.file_access_log USING GIN(metadata)
  WHERE metadata IS NOT NULL;

-- Composite index for time-based analytics per user
CREATE INDEX idx_file_access_log_user_time
  ON plugin_file_manager.file_access_log(user_id, accessed_at DESC)
  WHERE user_id IS NOT NULL;

-- =============================================================================
-- Partitioning Strategy (Optional - for future enhancement)
-- =============================================================================

-- For high-volume deployments, consider partitioning this table by accessed_at
-- Example: Monthly partitions for easier archival and performance
-- This can be implemented later if needed:
--
-- CREATE TABLE file_access_log_2025_11 PARTITION OF file_access_log
--   FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

-- =============================================================================
-- Comments for documentation
-- =============================================================================

COMMENT ON TABLE plugin_file_manager.file_access_log IS 'Audit trail for all file and folder access. Append-only table for compliance and analytics. Consider partitioning by accessed_at for high-volume deployments.';
COMMENT ON COLUMN plugin_file_manager.file_access_log.file_id IS 'Reference to file. NULL if this is a folder access log.';
COMMENT ON COLUMN plugin_file_manager.file_access_log.folder_id IS 'Reference to folder. NULL if this is a file access log.';
COMMENT ON COLUMN plugin_file_manager.file_access_log.user_id IS 'User who performed the action. NULL for anonymous access.';
COMMENT ON COLUMN plugin_file_manager.file_access_log.action IS 'Type of action: view, download, upload, delete, share, permission_change.';
COMMENT ON COLUMN plugin_file_manager.file_access_log.success IS 'Whether the action completed successfully.';
COMMENT ON COLUMN plugin_file_manager.file_access_log.error_message IS 'Error details if action failed.';
COMMENT ON COLUMN plugin_file_manager.file_access_log.metadata IS 'Flexible JSONB storage for additional context (e.g., {"download_size": 1024, "share_recipient": "user@example.com"}).';
COMMENT ON COLUMN plugin_file_manager.file_access_log.accessed_at IS 'Timestamp when the action occurred.';

COMMENT ON CONSTRAINT file_access_log_resource_check ON plugin_file_manager.file_access_log IS 'Ensures log entry is for either a file or folder, not both.';

-- Track this migration
INSERT INTO plugin_file_manager.plugin_migrations (migration_name, description)
VALUES ('05-create-file-access-log', 'Create file access log table for audit trail and analytics')
ON CONFLICT (migration_name) DO NOTHING;
