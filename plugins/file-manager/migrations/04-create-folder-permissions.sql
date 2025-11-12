-- Migration: Create folder permissions table
-- Description: Granular access control for folders with user and role-based permissions
-- Date: 2025-11-12

SET search_path TO plugin_file_manager, public;

-- =============================================================================
-- Table: plugin_file_manager.folder_permissions
-- Purpose: Granular access control for folders
-- =============================================================================

CREATE TABLE IF NOT EXISTS plugin_file_manager.folder_permissions (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationship
  folder_id UUID NOT NULL REFERENCES plugin_file_manager.folders(id) ON DELETE CASCADE,

  -- Permission target (either user OR role, not both)
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  role VARCHAR(50), -- admin, editor, viewer

  -- Permission type
  permission_type plugin_file_manager.permission_type NOT NULL,

  -- Audit trail
  granted_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Optional expiration
  expires_at TIMESTAMP, -- NULL = never expires

  -- Inheritance
  inherit_to_children BOOLEAN NOT NULL DEFAULT true, -- Whether permission applies to subfolders

  -- Constraints
  CONSTRAINT folder_permissions_user_or_role CHECK (
    (user_id IS NOT NULL AND role IS NULL) OR
    (user_id IS NULL AND role IS NOT NULL)
  ),
  CONSTRAINT folder_permissions_expiration_future CHECK (
    expires_at IS NULL OR expires_at > granted_at
  ),
  CONSTRAINT folder_permissions_role_valid CHECK (
    role IS NULL OR role IN ('admin', 'editor', 'viewer')
  )
);

-- Unique constraints for preventing duplicates
CREATE UNIQUE INDEX idx_folder_permissions_user_unique
  ON plugin_file_manager.folder_permissions(folder_id, user_id, permission_type)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX idx_folder_permissions_role_unique
  ON plugin_file_manager.folder_permissions(folder_id, role, permission_type)
  WHERE role IS NOT NULL;

-- =============================================================================
-- Indexes for plugin_file_manager.folder_permissions
-- =============================================================================

-- Query permissions for a folder (most common query)
CREATE INDEX idx_folder_permissions_folder_id
  ON plugin_file_manager.folder_permissions(folder_id);

-- Query user's permissions across folders
CREATE INDEX idx_folder_permissions_user_id
  ON plugin_file_manager.folder_permissions(user_id)
  WHERE user_id IS NOT NULL;

-- Query role permissions
CREATE INDEX idx_folder_permissions_role
  ON plugin_file_manager.folder_permissions(role)
  WHERE role IS NOT NULL;

-- Query expiring permissions (for cleanup jobs)
CREATE INDEX idx_folder_permissions_expires_at
  ON plugin_file_manager.folder_permissions(expires_at)
  WHERE expires_at IS NOT NULL;

-- Query by granted_by for audit
CREATE INDEX idx_folder_permissions_granted_by
  ON plugin_file_manager.folder_permissions(granted_by);

-- =============================================================================
-- Default Permissions
-- =============================================================================

-- Note: Default permissions are NOT inserted here because root folders may not exist yet.
-- They should be created when root folders are created or during plugin activation.

-- =============================================================================
-- Comments for documentation
-- =============================================================================

COMMENT ON TABLE plugin_file_manager.folder_permissions IS 'Granular access control for folders. Permissions can be granted to individual users or roles.';
COMMENT ON COLUMN plugin_file_manager.folder_permissions.user_id IS 'User-specific permission. NULL if role-based permission.';
COMMENT ON COLUMN plugin_file_manager.folder_permissions.role IS 'Role-based permission (admin, editor, viewer). NULL if user-specific permission.';
COMMENT ON COLUMN plugin_file_manager.folder_permissions.permission_type IS 'Type of permission: read, write, delete, share, admin.';
COMMENT ON COLUMN plugin_file_manager.folder_permissions.expires_at IS 'Optional expiration timestamp for temporary access. NULL = never expires.';
COMMENT ON COLUMN plugin_file_manager.folder_permissions.inherit_to_children IS 'If true, permission applies to all subfolders. If false, only applies to this folder.';

COMMENT ON CONSTRAINT folder_permissions_user_or_role ON plugin_file_manager.folder_permissions IS 'Ensures permission is granted to either a user or a role, not both.';

-- Track this migration
INSERT INTO plugin_file_manager.plugin_migrations (migration_name, description)
VALUES ('04-create-folder-permissions', 'Create folder permissions table for granular access control')
ON CONFLICT (migration_name) DO NOTHING;
