-- Create schema for comments plugin
CREATE SCHEMA IF NOT EXISTS plugin_comments;

-- Create comments table
CREATE TABLE IF NOT EXISTS plugin_comments.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL,
  user_id UUID NOT NULL,
  author_name VARCHAR(255) NOT NULL,
  author_email VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending', 'spam', 'deleted')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON plugin_comments.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON plugin_comments.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_status ON plugin_comments.comments(status);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON plugin_comments.comments(created_at DESC);

-- Create trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION plugin_comments.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON plugin_comments.comments
  FOR EACH ROW
  EXECUTE FUNCTION plugin_comments.update_updated_at_column();

-- Grant permissions (adjust based on your user setup)
GRANT USAGE ON SCHEMA plugin_comments TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA plugin_comments TO PUBLIC;
