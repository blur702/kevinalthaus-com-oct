-- Migration 25: Blog Plugin Tables
-- This migration creates all necessary tables and schemas for the blog plugin
-- Dependencies: users table (migration 01), files/media infrastructure

-- ============================================================================
-- PART 1: Content Manager Plugin Schema
-- ============================================================================

-- Create isolated schema for content manager plugin
CREATE SCHEMA IF NOT EXISTS plugin_content_manager;

-- Grant permissions (restricted to application role only, not PUBLIC for security)
GRANT USAGE ON SCHEMA plugin_content_manager TO postgres;
GRANT CREATE ON SCHEMA plugin_content_manager TO postgres;

-- Set search path for this migration
SET search_path TO plugin_content_manager, public;

-- Create enum types for content manager
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_status') THEN
    CREATE TYPE plugin_content_manager.content_status AS ENUM (
      'draft',
      'published',
      'scheduled',
      'archived'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_type') THEN
    CREATE TYPE plugin_content_manager.media_type AS ENUM (
      'image',
      'document',
      'video',
      'audio',
      'archive',
      'other'
    );
  END IF;
END
$$;

-- Migration tracking table for content manager plugin
CREATE TABLE IF NOT EXISTS plugin_content_manager.plugin_migrations (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  description TEXT
);

-- Track content manager migrations
INSERT INTO plugin_content_manager.plugin_migrations (migration_name, description)
VALUES ('01-create-schema', 'Initial schema and enum type creation')
ON CONFLICT (migration_name) DO NOTHING;

-- Main content table
CREATE TABLE IF NOT EXISTS plugin_content_manager.content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) NOT NULL,
  body_html TEXT NOT NULL DEFAULT '',
  excerpt TEXT,
  meta_description VARCHAR(160),
  meta_keywords TEXT,
  featured_image_id UUID,
  status plugin_content_manager.content_status NOT NULL DEFAULT 'draft',
  publish_at TIMESTAMP,
  published_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL,
  updated_by UUID,
  deleted_at TIMESTAMP,
  deleted_by UUID,

  -- Constraints
  CONSTRAINT content_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT content_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT content_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id) ON DELETE SET NULL
);

-- Partial unique index for slug that respects soft-deletes
CREATE UNIQUE INDEX IF NOT EXISTS content_slug_unique_idx ON plugin_content_manager.content (slug) WHERE deleted_at IS NULL;

-- Content version history table
CREATE TABLE IF NOT EXISTS plugin_content_manager.content_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) NOT NULL,
  body_html TEXT NOT NULL,
  excerpt TEXT,
  meta_description VARCHAR(160),
  meta_keywords TEXT,
  status plugin_content_manager.content_status NOT NULL,
  change_summary TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL,

  -- Constraints
  CONSTRAINT content_versions_content_id_fkey FOREIGN KEY (content_id) REFERENCES plugin_content_manager.content(id) ON DELETE CASCADE,
  CONSTRAINT content_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT content_versions_content_version_unique UNIQUE (content_id, version_number)
);

-- Indexes for content performance
CREATE INDEX IF NOT EXISTS idx_content_status ON plugin_content_manager.content(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_content_slug ON plugin_content_manager.content(slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_content_created_by ON plugin_content_manager.content(created_by);
CREATE INDEX IF NOT EXISTS idx_content_publish_at ON plugin_content_manager.content(publish_at) WHERE status = 'scheduled' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_content_published_at ON plugin_content_manager.content(published_at DESC) WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_content_deleted_at ON plugin_content_manager.content(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_search ON plugin_content_manager.content USING GIN(to_tsvector('english', title || ' ' || COALESCE(excerpt, '') || ' ' || body_html));

CREATE INDEX IF NOT EXISTS idx_content_versions_content_id ON plugin_content_manager.content_versions(content_id);
CREATE INDEX IF NOT EXISTS idx_content_versions_version ON plugin_content_manager.content_versions(content_id, version_number DESC);

-- Auto-update timestamp trigger function for content
CREATE OR REPLACE FUNCTION plugin_content_manager.update_content_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to content table
DROP TRIGGER IF EXISTS trigger_update_content_timestamp ON plugin_content_manager.content;
CREATE TRIGGER trigger_update_content_timestamp
  BEFORE UPDATE ON plugin_content_manager.content
  FOR EACH ROW
  EXECUTE FUNCTION plugin_content_manager.update_content_timestamp();

-- Function to create content version on update
CREATE OR REPLACE FUNCTION plugin_content_manager.create_content_version()
RETURNS TRIGGER AS $$
DECLARE
  next_version INTEGER;
BEGIN
  -- Only create version if content has actually changed
  IF (OLD.title IS DISTINCT FROM NEW.title OR
      OLD.slug IS DISTINCT FROM NEW.slug OR
      OLD.body_html IS DISTINCT FROM NEW.body_html OR
      OLD.excerpt IS DISTINCT FROM NEW.excerpt OR
      OLD.meta_description IS DISTINCT FROM NEW.meta_description OR
      OLD.meta_keywords IS DISTINCT FROM NEW.meta_keywords OR
      OLD.status IS DISTINCT FROM NEW.status) THEN

    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
    FROM plugin_content_manager.content_versions
    WHERE content_id = OLD.id;

    -- Insert version record
    INSERT INTO plugin_content_manager.content_versions (
      content_id,
      version_number,
      title,
      slug,
      body_html,
      excerpt,
      meta_description,
      meta_keywords,
      status,
      created_by
    ) VALUES (
      OLD.id,
      next_version,
      OLD.title,
      OLD.slug,
      OLD.body_html,
      OLD.excerpt,
      OLD.meta_description,
      OLD.meta_keywords,
      OLD.status,
      COALESCE(NEW.updated_by, OLD.created_by)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply version creation trigger
DROP TRIGGER IF EXISTS trigger_create_content_version ON plugin_content_manager.content;
CREATE TRIGGER trigger_create_content_version
  BEFORE UPDATE ON plugin_content_manager.content
  FOR EACH ROW
  EXECUTE FUNCTION plugin_content_manager.create_content_version();

-- Track content table migration
INSERT INTO plugin_content_manager.plugin_migrations (migration_name, description)
VALUES ('02-create-content-table', 'Create content and version history tables')
ON CONFLICT (migration_name) DO NOTHING;

-- Media files table
CREATE TABLE IF NOT EXISTS plugin_content_manager.media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(500) NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(255) NOT NULL,
  file_extension VARCHAR(50) NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  media_type plugin_content_manager.media_type NOT NULL DEFAULT 'other',
  width INTEGER,
  height INTEGER,
  duration INTEGER,
  alt_text VARCHAR(255),
  caption TEXT,
  content_id UUID,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  deleted_by UUID,

  -- Constraints
  CONSTRAINT media_filename_unique UNIQUE (filename),
  CONSTRAINT media_content_id_fkey FOREIGN KEY (content_id) REFERENCES plugin_content_manager.content(id) ON DELETE SET NULL,
  CONSTRAINT media_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT media_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT media_file_size_positive CHECK (file_size > 0),
  CONSTRAINT media_dimensions_valid CHECK (
    (width IS NULL AND height IS NULL) OR
    (width > 0 AND height > 0)
  )
);

-- Indexes for media performance
CREATE INDEX IF NOT EXISTS idx_media_content_id ON plugin_content_manager.media(content_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_uploaded_by ON plugin_content_manager.media(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_media_mime_type ON plugin_content_manager.media(mime_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_type ON plugin_content_manager.media(media_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_created_at ON plugin_content_manager.media(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_deleted_at ON plugin_content_manager.media(deleted_at) WHERE deleted_at IS NOT NULL;

-- Add foreign key from content table to media (for featured images)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'content_featured_image_fkey'
  ) THEN
    ALTER TABLE plugin_content_manager.content
      ADD CONSTRAINT content_featured_image_fkey
      FOREIGN KEY (featured_image_id)
      REFERENCES plugin_content_manager.media(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

-- Function to automatically detect media type from MIME type
CREATE OR REPLACE FUNCTION plugin_content_manager.set_media_type()
RETURNS TRIGGER AS $$
BEGIN
  -- Determine media type based on MIME type
  IF NEW.mime_type LIKE 'image/%' THEN
    NEW.media_type = 'image';
  ELSIF NEW.mime_type LIKE 'video/%' THEN
    NEW.media_type = 'video';
  ELSIF NEW.mime_type LIKE 'audio/%' THEN
    NEW.media_type = 'audio';
  ELSIF NEW.mime_type IN ('application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') THEN
    NEW.media_type = 'document';
  ELSIF NEW.mime_type IN ('application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed', 'application/x-7z-compressed') THEN
    NEW.media_type = 'archive';
  ELSE
    NEW.media_type = 'other';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply media type auto-detection trigger
DROP TRIGGER IF EXISTS trigger_set_media_type ON plugin_content_manager.media;
CREATE TRIGGER trigger_set_media_type
  BEFORE INSERT ON plugin_content_manager.media
  FOR EACH ROW
  EXECUTE FUNCTION plugin_content_manager.set_media_type();

-- Track media table migration
INSERT INTO plugin_content_manager.plugin_migrations (migration_name, description)
VALUES ('04-create-media-table', 'Create media files table with metadata')
ON CONFLICT (migration_name) DO NOTHING;

-- ============================================================================
-- PART 2: Blog Plugin Schema
-- ============================================================================

-- Create isolated schema for blog plugin
CREATE SCHEMA IF NOT EXISTS plugin_blog;

-- Grant permissions (restricted to application role only, not PUBLIC for security)
GRANT USAGE ON SCHEMA plugin_blog TO postgres;
GRANT CREATE ON SCHEMA plugin_blog TO postgres;

-- Set search path for blog plugin
SET search_path TO plugin_blog, public;

-- Create enum types for blog plugin
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blog_status') THEN
    CREATE TYPE plugin_blog.blog_status AS ENUM (
      'draft',
      'published',
      'scheduled',
      'archived'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'preview_token_status') THEN
    CREATE TYPE plugin_blog.preview_token_status AS ENUM (
      'active',
      'expired',
      'revoked'
    );
  END IF;
END
$$;

-- Migration tracking table for blog plugin
CREATE TABLE IF NOT EXISTS plugin_blog.plugin_migrations (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  description TEXT
);

-- Track blog schema migration
INSERT INTO plugin_blog.plugin_migrations (migration_name, description)
VALUES ('01-create-schema', 'Initial schema and enum type creation for blog plugin')
ON CONFLICT (migration_name) DO NOTHING;

-- Main blog posts table
CREATE TABLE IF NOT EXISTS plugin_blog.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) NOT NULL,
  body_html TEXT NOT NULL DEFAULT '',
  excerpt TEXT,
  meta_description VARCHAR(160),
  meta_keywords TEXT,
  author_id UUID NOT NULL,
  reading_time_minutes INTEGER,
  allow_comments BOOLEAN DEFAULT true,
  comment_count INTEGER DEFAULT 0,
  featured_image_id UUID,
  status plugin_blog.blog_status NOT NULL DEFAULT 'draft',
  publish_at TIMESTAMP,
  published_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL,
  updated_by UUID,
  deleted_at TIMESTAMP,
  deleted_by UUID,

  -- Constraints
  CONSTRAINT blog_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT blog_posts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT blog_posts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT blog_posts_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT blog_posts_featured_image_id_fkey FOREIGN KEY (featured_image_id) REFERENCES plugin_content_manager.media(id) ON DELETE SET NULL
);

-- Partial unique index for slug that respects soft-deletes
CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_slug_unique_idx ON plugin_blog.blog_posts (slug) WHERE deleted_at IS NULL;

-- Blog post version history table
CREATE TABLE IF NOT EXISTS plugin_blog.blog_post_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_post_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) NOT NULL,
  body_html TEXT NOT NULL,
  excerpt TEXT,
  meta_description VARCHAR(160),
  meta_keywords TEXT,
  status plugin_blog.blog_status NOT NULL,
  change_summary TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL,

  -- Constraints
  CONSTRAINT blog_post_versions_blog_post_id_fkey FOREIGN KEY (blog_post_id) REFERENCES plugin_blog.blog_posts(id) ON DELETE CASCADE,
  CONSTRAINT blog_post_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT blog_post_versions_blog_post_version_unique UNIQUE (blog_post_id, version_number)
);

-- Indexes for blog posts performance
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON plugin_blog.blog_posts(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON plugin_blog.blog_posts(slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_blog_posts_author_id ON plugin_blog.blog_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_created_by ON plugin_blog.blog_posts(created_by);
CREATE INDEX IF NOT EXISTS idx_blog_posts_publish_at ON plugin_blog.blog_posts(publish_at) WHERE status = 'scheduled' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON plugin_blog.blog_posts(published_at DESC) WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_blog_posts_deleted_at ON plugin_blog.blog_posts(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blog_posts_search ON plugin_blog.blog_posts USING GIN(to_tsvector('english', title || ' ' || COALESCE(excerpt, '') || ' ' || body_html));

CREATE INDEX IF NOT EXISTS idx_blog_post_versions_blog_post_id ON plugin_blog.blog_post_versions(blog_post_id);
CREATE INDEX IF NOT EXISTS idx_blog_post_versions_version ON plugin_blog.blog_post_versions(blog_post_id, version_number DESC);

-- Auto-update timestamp trigger function for blog posts
CREATE OR REPLACE FUNCTION plugin_blog.update_blog_post_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to blog_posts table
DROP TRIGGER IF EXISTS trigger_update_blog_post_timestamp ON plugin_blog.blog_posts;
CREATE TRIGGER trigger_update_blog_post_timestamp
  BEFORE UPDATE ON plugin_blog.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION plugin_blog.update_blog_post_timestamp();

-- Function to create blog post version on update
CREATE OR REPLACE FUNCTION plugin_blog.create_blog_post_version()
RETURNS TRIGGER AS $$
DECLARE
  next_version INTEGER;
BEGIN
  -- Only create version if content has actually changed
  IF (OLD.title IS DISTINCT FROM NEW.title OR
      OLD.slug IS DISTINCT FROM NEW.slug OR
      OLD.body_html IS DISTINCT FROM NEW.body_html OR
      OLD.excerpt IS DISTINCT FROM NEW.excerpt OR
      OLD.meta_description IS DISTINCT FROM NEW.meta_description OR
      OLD.meta_keywords IS DISTINCT FROM NEW.meta_keywords OR
      OLD.status IS DISTINCT FROM NEW.status) THEN

    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
    FROM plugin_blog.blog_post_versions
    WHERE blog_post_id = OLD.id;

    -- Insert version record
    INSERT INTO plugin_blog.blog_post_versions (
      blog_post_id,
      version_number,
      title,
      slug,
      body_html,
      excerpt,
      meta_description,
      meta_keywords,
      status,
      created_by
    ) VALUES (
      OLD.id,
      next_version,
      OLD.title,
      OLD.slug,
      OLD.body_html,
      OLD.excerpt,
      OLD.meta_description,
      OLD.meta_keywords,
      OLD.status,
      COALESCE(NEW.updated_by, OLD.created_by)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply version creation trigger
DROP TRIGGER IF EXISTS trigger_create_blog_post_version ON plugin_blog.blog_posts;
CREATE TRIGGER trigger_create_blog_post_version
  BEFORE UPDATE ON plugin_blog.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION plugin_blog.create_blog_post_version();

-- Track blog posts table migration
INSERT INTO plugin_blog.plugin_migrations (migration_name, description)
VALUES ('02-create-blog-tables', 'Create blog posts and version history tables')
ON CONFLICT (migration_name) DO NOTHING;

-- Author profiles table
CREATE TABLE IF NOT EXISTS plugin_blog.author_profiles (
  user_id UUID PRIMARY KEY,
  display_name VARCHAR(255),
  bio TEXT,
  avatar_url TEXT,
  website_url TEXT,
  twitter_handle VARCHAR(100),
  linkedin_url TEXT,
  github_username VARCHAR(100),
  social_links JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT author_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Indexes for author profiles
CREATE INDEX IF NOT EXISTS idx_author_profiles_display_name ON plugin_blog.author_profiles(display_name);

-- Auto-update timestamp trigger function for author profiles
CREATE OR REPLACE FUNCTION plugin_blog.update_author_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to author_profiles table
DROP TRIGGER IF EXISTS trigger_update_author_profile_timestamp ON plugin_blog.author_profiles;
CREATE TRIGGER trigger_update_author_profile_timestamp
  BEFORE UPDATE ON plugin_blog.author_profiles
  FOR EACH ROW
  EXECUTE FUNCTION plugin_blog.update_author_profile_timestamp();

-- Track author profiles migration
INSERT INTO plugin_blog.plugin_migrations (migration_name, description)
VALUES ('03-create-author-profiles', 'Create author profiles table')
ON CONFLICT (migration_name) DO NOTHING;

-- SEO metadata table
CREATE TABLE IF NOT EXISTS plugin_blog.blog_seo_metadata (
  blog_post_id UUID PRIMARY KEY,
  og_title VARCHAR(255),
  og_description TEXT,
  og_image_url TEXT,
  og_type VARCHAR(50) DEFAULT 'article',
  twitter_card_type VARCHAR(50) DEFAULT 'summary_large_image',
  twitter_title VARCHAR(255),
  twitter_description TEXT,
  twitter_image_url TEXT,
  canonical_url TEXT,
  robots_meta VARCHAR(100) DEFAULT 'index, follow',
  structured_data JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT blog_seo_metadata_blog_post_id_fkey FOREIGN KEY (blog_post_id) REFERENCES plugin_blog.blog_posts(id) ON DELETE CASCADE
);

-- Indexes for SEO metadata
CREATE INDEX IF NOT EXISTS idx_blog_seo_metadata_blog_post_id ON plugin_blog.blog_seo_metadata(blog_post_id);

-- Auto-update timestamp trigger function for SEO metadata
CREATE OR REPLACE FUNCTION plugin_blog.update_blog_seo_metadata_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to blog_seo_metadata table
DROP TRIGGER IF EXISTS trigger_update_blog_seo_metadata_timestamp ON plugin_blog.blog_seo_metadata;
CREATE TRIGGER trigger_update_blog_seo_metadata_timestamp
  BEFORE UPDATE ON plugin_blog.blog_seo_metadata
  FOR EACH ROW
  EXECUTE FUNCTION plugin_blog.update_blog_seo_metadata_timestamp();

-- Preview tokens table
CREATE TABLE IF NOT EXISTS plugin_blog.preview_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_post_id UUID NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  status plugin_blog.preview_token_status DEFAULT 'active',
  expires_at TIMESTAMP NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP,

  -- Constraints
  CONSTRAINT preview_tokens_blog_post_id_fkey FOREIGN KEY (blog_post_id) REFERENCES plugin_blog.blog_posts(id) ON DELETE CASCADE,
  CONSTRAINT preview_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT preview_tokens_expires_at_check CHECK (expires_at > created_at)
);

-- Indexes for preview tokens
CREATE UNIQUE INDEX IF NOT EXISTS idx_preview_tokens_token ON plugin_blog.preview_tokens(token);
CREATE INDEX IF NOT EXISTS idx_preview_tokens_blog_post_id ON plugin_blog.preview_tokens(blog_post_id);
CREATE INDEX IF NOT EXISTS idx_preview_tokens_expires_at ON plugin_blog.preview_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_preview_tokens_status ON plugin_blog.preview_tokens(status);

-- Track SEO metadata and preview tokens migration
INSERT INTO plugin_blog.plugin_migrations (migration_name, description)
VALUES ('04-create-seo-metadata', 'Create SEO metadata and preview tokens tables')
ON CONFLICT (migration_name) DO NOTHING;

-- Reset search path
SET search_path TO public;
