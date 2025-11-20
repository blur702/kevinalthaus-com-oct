-- ============================================================================
-- Page Builder Plugin - Schema Initialization
-- Migration: 01-create-schema.sql
-- Description: Create isolated schema and base enums for page builder
-- ============================================================================

-- Create isolated schema for security and multi-tenancy
CREATE SCHEMA IF NOT EXISTS plugin_page_builder;

-- Grant necessary permissions (adjust role as needed for your environment)
GRANT USAGE, CREATE ON SCHEMA plugin_page_builder TO postgres;

-- Set search path for this migration
SET search_path TO plugin_page_builder, public;

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Page publication status
CREATE TYPE plugin_page_builder.page_status AS ENUM (
  'draft',
  'published',
  'scheduled',
  'archived'
);

-- Content type discriminator to distinguish between regular pages and blog posts
CREATE TYPE plugin_page_builder.content_type AS ENUM (
  'page',
  'blog_post'
);

-- ============================================================================
-- MIGRATION TRACKING TABLE
-- ============================================================================

-- Track applied migrations for idempotency
CREATE TABLE IF NOT EXISTS plugin_page_builder.plugin_migrations (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  description TEXT
);

-- Record this migration
INSERT INTO plugin_page_builder.plugin_migrations (migration_name, description)
VALUES ('01-create-schema', 'Initial schema creation and enums for page builder')
ON CONFLICT (migration_name) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON SCHEMA plugin_page_builder IS 'Isolated schema for Page Builder plugin - prevents namespace collisions';
COMMENT ON TYPE plugin_page_builder.page_status IS 'Page publication workflow states';
COMMENT ON TYPE plugin_page_builder.content_type IS 'Distinguishes between regular pages and blog posts in unified content system';
COMMENT ON TABLE plugin_page_builder.plugin_migrations IS 'Tracks applied migrations for idempotent execution';
