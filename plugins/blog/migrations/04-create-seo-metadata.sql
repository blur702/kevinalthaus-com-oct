SET search_path TO plugin_blog, public;

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_blog_seo_metadata_blog_post_id ON plugin_blog.blog_seo_metadata(blog_post_id);

-- Auto-update timestamp trigger function
CREATE OR REPLACE FUNCTION plugin_blog.update_blog_seo_metadata_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to blog_seo_metadata table
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

-- Indexes for performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_preview_tokens_token ON plugin_blog.preview_tokens(token);
CREATE INDEX IF NOT EXISTS idx_preview_tokens_blog_post_id ON plugin_blog.preview_tokens(blog_post_id);
CREATE INDEX IF NOT EXISTS idx_preview_tokens_expires_at ON plugin_blog.preview_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_preview_tokens_status ON plugin_blog.preview_tokens(status);

-- Track migration
INSERT INTO plugin_blog.plugin_migrations (migration_name, description)
VALUES ('04-create-seo-metadata', 'Create SEO metadata and preview tokens tables')
ON CONFLICT (migration_name) DO NOTHING;
