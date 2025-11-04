-- Create isolated schema for user-manager plugin
CREATE SCHEMA IF NOT EXISTS plugin_user_manager;

-- Grant permissions (restricted to application role only, not PUBLIC for security)
-- Note: Adjust 'postgres' to your actual application database role
GRANT USAGE ON SCHEMA plugin_user_manager TO postgres;
GRANT CREATE ON SCHEMA plugin_user_manager TO postgres;

-- Set search path for this migration
SET search_path TO plugin_user_manager, public;

-- Create enum types for activity tracking
CREATE TYPE plugin_user_manager.activity_type AS ENUM (
  'login',
  'logout',
  'password_change',
  'profile_update',
  'role_change',
  'account_created',
  'account_deleted',
  'account_suspended',
  'account_reactivated',
  'permission_change',
  'api_access',
  'custom_field_update',
  'bulk_operation',
  'other'
);

CREATE TYPE plugin_user_manager.audit_action AS ENUM (
  'create',
  'read',
  'update',
  'delete',
  'bulk_import',
  'bulk_export',
  'security_event'
);

-- Migration tracking table for plugin-specific migrations
CREATE TABLE IF NOT EXISTS plugin_user_manager.plugin_migrations (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert record for this migration
INSERT INTO plugin_user_manager.plugin_migrations (migration_name)
VALUES ('01-create-schema')
ON CONFLICT (migration_name) DO NOTHING;
