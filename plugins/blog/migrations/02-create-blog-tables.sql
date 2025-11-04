SET search_path TO plugin_blog, public;

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
CREATE UNIQUE INDEX blog_posts_slug_unique_idx ON plugin_blog.blog_posts (slug) WHERE deleted_at IS NULL;

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

-- Indexes for performance
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

-- Auto-update timestamp trigger function
CREATE OR REPLACE FUNCTION plugin_blog.update_blog_post_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to blog_posts table
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
CREATE TRIGGER trigger_create_blog_post_version
  BEFORE UPDATE ON plugin_blog.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION plugin_blog.create_blog_post_version();

-- Track migration
INSERT INTO plugin_blog.plugin_migrations (migration_name, description)
VALUES ('02-create-blog-tables', 'Create blog posts and version history tables')
ON CONFLICT (migration_name) DO NOTHING;
