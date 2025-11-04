SET search_path TO plugin_blog, public;

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_author_profiles_display_name ON plugin_blog.author_profiles(display_name);

-- Auto-update timestamp trigger function
CREATE OR REPLACE FUNCTION plugin_blog.update_author_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to author_profiles table
CREATE TRIGGER trigger_update_author_profile_timestamp
  BEFORE UPDATE ON plugin_blog.author_profiles
  FOR EACH ROW
  EXECUTE FUNCTION plugin_blog.update_author_profile_timestamp();

-- Track migration
INSERT INTO plugin_blog.plugin_migrations (migration_name, description)
VALUES ('03-create-author-profiles', 'Create author profiles table')
ON CONFLICT (migration_name) DO NOTHING;
