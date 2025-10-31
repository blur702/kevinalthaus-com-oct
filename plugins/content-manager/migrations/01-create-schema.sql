-- Create isolated schema for content manager plugin
CREATE SCHEMA IF NOT EXISTS plugin_content_manager;

-- Grant permissions (restricted to application role only, not PUBLIC for security)
-- Note: Adjust 'postgres' to your actual application database role
GRANT USAGE ON SCHEMA plugin_content_manager TO postgres;
GRANT CREATE ON SCHEMA plugin_content_manager TO postgres;

-- Set search path for this migration
SET search_path TO plugin_content_manager, public;

-- Create enum types
CREATE TYPE plugin_content_manager.content_status AS ENUM (
  'draft',
  'published',
  'scheduled',
  'archived'
);

CREATE TYPE plugin_content_manager.media_type AS ENUM (
  'image',
  'document',
  'video',
  'audio',
  'archive',
  'other'
);

-- Migration tracking table
CREATE TABLE IF NOT EXISTS plugin_content_manager.plugin_migrations (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  description TEXT
);

-- Track this migration
INSERT INTO plugin_content_manager.plugin_migrations (migration_name, description)
VALUES ('01-create-schema', 'Initial schema and enum type creation')
ON CONFLICT (migration_name) DO NOTHING;
