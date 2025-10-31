SET search_path TO plugin_content_manager, public;

-- Allowed file types configuration table
CREATE TABLE IF NOT EXISTS plugin_content_manager.allowed_file_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mime_type VARCHAR(255) NOT NULL,
  file_extension VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  max_file_size BIGINT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL,
  updated_by UUID,

  -- Constraints
  CONSTRAINT allowed_file_types_mime_ext_unique UNIQUE (mime_type, file_extension),
  CONSTRAINT allowed_file_types_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT allowed_file_types_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT allowed_file_types_max_size_positive CHECK (max_file_size IS NULL OR max_file_size > 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_allowed_file_types_mime ON plugin_content_manager.allowed_file_types(mime_type) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_allowed_file_types_ext ON plugin_content_manager.allowed_file_types(file_extension) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_allowed_file_types_category ON plugin_content_manager.allowed_file_types(category) WHERE is_enabled = true;

-- Auto-update timestamp trigger
CREATE TRIGGER trigger_update_file_types_timestamp
  BEFORE UPDATE ON plugin_content_manager.allowed_file_types
  FOR EACH ROW
  EXECUTE FUNCTION plugin_content_manager.update_content_timestamp();

-- Insert default allowed file types (based on user requirements)
-- Will be executed during plugin installation

-- Ensure we have a valid admin user ID for created_by
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  SELECT id INTO admin_user_id FROM public.users WHERE role = 'admin' ORDER BY created_at LIMIT 1;

  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'No admin user found. Please create an admin user before running this migration.';
  END IF;
END $$;

-- Images
INSERT INTO plugin_content_manager.allowed_file_types (mime_type, file_extension, category, description, max_file_size, created_by)
SELECT
  mime_type,
  extension,
  'image',
  description,
  10485760, -- 10MB default
  (SELECT id FROM public.users WHERE role = 'admin' ORDER BY created_at LIMIT 1)
FROM (VALUES
  ('image/png', 'png', 'PNG images'),
  ('image/jpeg', 'jpg', 'JPEG images'),
  ('image/jpeg', 'jpeg', 'JPEG images (alternate extension)'),
  ('image/gif', 'gif', 'GIF images'),
  ('image/webp', 'webp', 'WebP images')
) AS t(mime_type, extension, description)
ON CONFLICT (mime_type, file_extension) DO NOTHING;

-- Documents
INSERT INTO plugin_content_manager.allowed_file_types (mime_type, file_extension, category, description, max_file_size, created_by)
SELECT
  mime_type,
  extension,
  'document',
  description,
  52428800, -- 50MB default for documents
  (SELECT id FROM public.users WHERE role = 'admin' ORDER BY created_at LIMIT 1)
FROM (VALUES
  ('application/pdf', 'pdf', 'PDF documents'),
  ('application/msword', 'doc', 'Microsoft Word documents (legacy)'),
  ('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx', 'Microsoft Word documents')
) AS t(mime_type, extension, description)
ON CONFLICT (mime_type, file_extension) DO NOTHING;

-- Media (video/audio)
INSERT INTO plugin_content_manager.allowed_file_types (mime_type, file_extension, category, description, max_file_size, created_by)
SELECT
  mime_type,
  extension,
  category,
  description,
  104857600, -- 100MB default for media
  (SELECT id FROM public.users WHERE role = 'admin' ORDER BY created_at LIMIT 1)
FROM (VALUES
  ('video/mp4', 'mp4', 'video', 'MP4 video files'),
  ('audio/mpeg', 'mp3', 'audio', 'MP3 audio files'),
  ('audio/wav', 'wav', 'audio', 'WAV audio files')
) AS t(mime_type, extension, category, description)
ON CONFLICT (mime_type, file_extension) DO NOTHING;

-- Archives
INSERT INTO plugin_content_manager.allowed_file_types (mime_type, file_extension, category, description, max_file_size, created_by)
SELECT
  mime_type,
  extension,
  'archive',
  description,
  104857600, -- 100MB default for archives
  (SELECT id FROM public.users WHERE role = 'admin' ORDER BY created_at LIMIT 1)
FROM (VALUES
  ('application/zip', 'zip', 'ZIP compressed archives'),
  ('application/x-zip-compressed', 'zip', 'ZIP compressed archives (alternate MIME)'),
  ('application/x-rar-compressed', 'rar', 'RAR compressed archives'),
  ('application/x-7z-compressed', '7z', '7-Zip compressed archives')
) AS t(mime_type, extension, description)
ON CONFLICT (mime_type, file_extension) DO NOTHING;

-- Custom types (PSD, AI, JSON, XML)
INSERT INTO plugin_content_manager.allowed_file_types (mime_type, file_extension, category, description, max_file_size, created_by)
SELECT
  mime_type,
  extension,
  'other',
  description,
  104857600, -- 100MB default
  (SELECT id FROM public.users WHERE role = 'admin' ORDER BY created_at LIMIT 1)
FROM (VALUES
  ('image/vnd.adobe.photoshop', 'psd', 'Adobe Photoshop files'),
  ('application/postscript', 'ai', 'Adobe Illustrator files'),
  ('application/json', 'json', 'JSON data files'),
  ('application/xml', 'xml', 'XML data files'),
  ('text/xml', 'xml', 'XML data files (text MIME)')
) AS t(mime_type, extension, description)
ON CONFLICT (mime_type, file_extension) DO NOTHING;

-- Track migration
INSERT INTO plugin_content_manager.plugin_migrations (migration_name, description)
VALUES ('05-create-file-types-table', 'Create file types configuration table with defaults')
ON CONFLICT (migration_name) DO NOTHING;
