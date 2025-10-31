SET search_path TO plugin_content_manager, public;

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_media_content_id ON plugin_content_manager.media(content_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_uploaded_by ON plugin_content_manager.media(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_media_mime_type ON plugin_content_manager.media(mime_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_type ON plugin_content_manager.media(media_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_created_at ON plugin_content_manager.media(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_deleted_at ON plugin_content_manager.media(deleted_at) WHERE deleted_at IS NOT NULL;

-- Add foreign key from content table to media (for featured images)
ALTER TABLE plugin_content_manager.content
  ADD CONSTRAINT content_featured_image_fkey
  FOREIGN KEY (featured_image_id)
  REFERENCES plugin_content_manager.media(id)
  ON DELETE SET NULL;

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
CREATE TRIGGER trigger_set_media_type
  BEFORE INSERT ON plugin_content_manager.media
  FOR EACH ROW
  EXECUTE FUNCTION plugin_content_manager.set_media_type();

-- Track migration
INSERT INTO plugin_content_manager.plugin_migrations (migration_name, description)
VALUES ('04-create-media-table', 'Create media files table with metadata')
ON CONFLICT (migration_name) DO NOTHING;
