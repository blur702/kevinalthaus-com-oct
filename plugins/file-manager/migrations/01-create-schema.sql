-- Create isolated schema for file-manager plugin
CREATE SCHEMA IF NOT EXISTS plugin_file_manager;

-- Grant permissions (restricted to application role only, not PUBLIC for security)
-- Note: Adjust 'postgres' to your actual application database role
GRANT USAGE ON SCHEMA plugin_file_manager TO postgres;
GRANT CREATE ON SCHEMA plugin_file_manager TO postgres;

-- Set search path for this migration
SET search_path TO plugin_file_manager, public;

-- Create enum types
CREATE TYPE plugin_file_manager.folder_type AS ENUM (
  'root',
  'standard',
  'system'
);

CREATE TYPE plugin_file_manager.permission_type AS ENUM (
  'read',
  'write',
  'delete',
  'share',
  'admin'
);

CREATE TYPE plugin_file_manager.access_action AS ENUM (
  'view',
  'download',
  'upload',
  'delete',
  'share',
  'permission_change'
);

-- Migration tracking table
CREATE TABLE IF NOT EXISTS plugin_file_manager.plugin_migrations (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  description TEXT
);

-- Track this migration
INSERT INTO plugin_file_manager.plugin_migrations (migration_name, description)
VALUES ('01-create-schema', 'Initial schema and enum type creation for file-manager plugin')
ON CONFLICT (migration_name) DO NOTHING;
