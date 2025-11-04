-- Create isolated schema for blog plugin
CREATE SCHEMA IF NOT EXISTS plugin_blog;

-- Grant permissions (restricted to application role only, not PUBLIC for security)
-- Note: Adjust 'postgres' to your actual application database role
GRANT USAGE ON SCHEMA plugin_blog TO postgres;
GRANT CREATE ON SCHEMA plugin_blog TO postgres;

-- Set search path for this migration
SET search_path TO plugin_blog, public;

-- Create enum types
CREATE TYPE plugin_blog.blog_status AS ENUM (
  'draft',
  'published',
  'scheduled',
  'archived'
);

CREATE TYPE plugin_blog.preview_token_status AS ENUM (
  'active',
  'expired',
  'revoked'
);

-- Migration tracking table
CREATE TABLE IF NOT EXISTS plugin_blog.plugin_migrations (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  description TEXT
);

-- Track this migration
INSERT INTO plugin_blog.plugin_migrations (migration_name, description)
VALUES ('01-create-schema', 'Initial schema and enum type creation for blog plugin')
ON CONFLICT (migration_name) DO NOTHING;
