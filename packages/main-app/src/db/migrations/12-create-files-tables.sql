-- Migration: Create shared file storage tables
-- Description: Create public.files and public.allowed_file_types tables for plugin-accessible file uploads
-- Date: 2025-11-05

-- =============================================================================
-- Table: public.files
-- Purpose: Central file metadata storage for all plugins
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.files (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Plugin association
  plugin_id VARCHAR(255) NOT NULL,

  -- File identification
  filename VARCHAR(500) NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(255) NOT NULL,
  file_extension VARCHAR(50) NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  storage_provider VARCHAR(50) NOT NULL DEFAULT 'local',

  -- Media metadata (optional, populated for images/video/audio)
  width INTEGER,
  height INTEGER,
  duration INTEGER, -- For video/audio in seconds

  -- User-provided metadata
  alt_text VARCHAR(255),
  caption TEXT,
  tags TEXT[], -- PostgreSQL array for flexible tagging

  -- Audit trail
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Soft delete support
  deleted_at TIMESTAMP,
  deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT files_file_size_positive CHECK (file_size > 0),
  CONSTRAINT files_dimensions_valid CHECK (
    (width IS NULL AND height IS NULL) OR (width > 0 AND height > 0)
  ),
  CONSTRAINT files_duration_positive CHECK (duration IS NULL OR duration > 0)
);

-- =============================================================================
-- Indexes for public.files
-- =============================================================================

-- Query by plugin (most common filter)
CREATE INDEX idx_files_plugin_id ON public.files(plugin_id) WHERE deleted_at IS NULL;

-- Query by uploader
CREATE INDEX idx_files_uploaded_by ON public.files(uploaded_by);

-- Query by MIME type (e.g., all images)
CREATE INDEX idx_files_mime_type ON public.files(mime_type) WHERE deleted_at IS NULL;

-- Sort by creation date (most recent first)
CREATE INDEX idx_files_created_at ON public.files(created_at DESC) WHERE deleted_at IS NULL;

-- Full-text search on filename and original name
CREATE INDEX idx_files_filename_search ON public.files USING GIN(to_tsvector('english', filename || ' ' || original_name)) WHERE deleted_at IS NULL;

-- Tag-based queries (PostgreSQL GIN index for array containment)
CREATE INDEX idx_files_tags ON public.files USING GIN(tags) WHERE deleted_at IS NULL;

-- Soft delete queries
CREATE INDEX idx_files_deleted_at ON public.files(deleted_at) WHERE deleted_at IS NOT NULL;

-- =============================================================================
-- Table: public.allowed_file_types
-- Purpose: Configurable allowlist of file types with size limits
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.allowed_file_types (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- File type identification
  mime_type VARCHAR(255) NOT NULL,
  file_extension VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL, -- image, video, audio, document, archive, other

  -- Metadata
  description TEXT,
  max_file_size BIGINT, -- In bytes, NULL = no limit
  is_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Audit trail
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT allowed_file_types_mime_ext_unique UNIQUE (mime_type, file_extension),
  CONSTRAINT allowed_file_types_max_size_positive CHECK (max_file_size IS NULL OR max_file_size > 0),
  CONSTRAINT allowed_file_types_category_valid CHECK (
    category IN ('image', 'video', 'audio', 'document', 'archive', 'other')
  )
);

-- =============================================================================
-- Indexes for public.allowed_file_types
-- =============================================================================

-- Query enabled types only
CREATE INDEX idx_allowed_file_types_enabled ON public.allowed_file_types(is_enabled) WHERE is_enabled = true;

-- Query by category
CREATE INDEX idx_allowed_file_types_category ON public.allowed_file_types(category) WHERE is_enabled = true;

-- =============================================================================
-- Insert default allowed file types
-- =============================================================================

-- Get or create system user ID for created_by
DO $$
DECLARE
  admin_id UUID;
  system_user_uuid UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Get first admin user
  SELECT id INTO admin_id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1;

  -- If no admin found, use first user
  IF admin_id IS NULL THEN
    SELECT id INTO admin_id FROM users ORDER BY created_at LIMIT 1;
  END IF;

  -- If still no user found, create a system user with fixed UUID
  IF admin_id IS NULL THEN
    INSERT INTO users (id, email, password_hash, role, created_at)
    VALUES (
      system_user_uuid,
      'system@localhost',
      '$2b$12$PLACEHOLDER_HASH_SYSTEM_USER_LOCKED',
      'admin',
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (id) DO NOTHING;

    admin_id := system_user_uuid;
  END IF;

  -- Now admin_id is guaranteed to exist
  IF admin_id IS NOT NULL THEN
    -- Images
    INSERT INTO public.allowed_file_types (mime_type, file_extension, category, description, max_file_size, created_by)
    VALUES
      ('image/jpeg', 'jpg', 'image', 'JPEG image', 10485760, admin_id), -- 10MB
      ('image/jpeg', 'jpeg', 'image', 'JPEG image', 10485760, admin_id),
      ('image/png', 'png', 'image', 'PNG image', 10485760, admin_id),
      ('image/gif', 'gif', 'image', 'GIF image', 10485760, admin_id),
      ('image/webp', 'webp', 'image', 'WebP image', 10485760, admin_id),
      ('image/svg+xml', 'svg', 'image', 'SVG vector image', 2097152, admin_id), -- 2MB
      ('image/bmp', 'bmp', 'image', 'Bitmap image', 10485760, admin_id),
      ('image/tiff', 'tiff', 'image', 'TIFF image', 20971520, admin_id), -- 20MB
      ('image/tiff', 'tif', 'image', 'TIFF image', 20971520, admin_id),

    -- Documents
      ('application/pdf', 'pdf', 'document', 'PDF document', 20971520, admin_id), -- 20MB
      ('application/msword', 'doc', 'document', 'Microsoft Word document (legacy)', 10485760, admin_id),
      ('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx', 'document', 'Microsoft Word document', 10485760, admin_id),
      ('application/vnd.ms-excel', 'xls', 'document', 'Microsoft Excel spreadsheet (legacy)', 10485760, admin_id),
      ('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx', 'document', 'Microsoft Excel spreadsheet', 10485760, admin_id),
      ('application/vnd.ms-powerpoint', 'ppt', 'document', 'Microsoft PowerPoint presentation (legacy)', 20971520, admin_id),
      ('application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx', 'document', 'Microsoft PowerPoint presentation', 20971520, admin_id),
      ('text/plain', 'txt', 'document', 'Plain text file', 5242880, admin_id), -- 5MB
      ('text/csv', 'csv', 'document', 'CSV file', 10485760, admin_id),
      ('text/markdown', 'md', 'document', 'Markdown file', 5242880, admin_id),
      ('application/rtf', 'rtf', 'document', 'Rich Text Format', 5242880, admin_id),

    -- Archives
      ('application/zip', 'zip', 'archive', 'ZIP archive', 52428800, admin_id), -- 50MB
      ('application/x-rar-compressed', 'rar', 'archive', 'RAR archive', 52428800, admin_id),
      ('application/x-7z-compressed', '7z', 'archive', '7-Zip archive', 52428800, admin_id),
      ('application/x-tar', 'tar', 'archive', 'TAR archive', 52428800, admin_id),
      ('application/gzip', 'gz', 'archive', 'GZIP compressed file', 52428800, admin_id),

    -- Video
      ('video/mp4', 'mp4', 'video', 'MP4 video', 104857600, admin_id), -- 100MB
      ('video/mpeg', 'mpeg', 'video', 'MPEG video', 104857600, admin_id),
      ('video/mpeg', 'mpg', 'video', 'MPEG video', 104857600, admin_id),
      ('video/quicktime', 'mov', 'video', 'QuickTime video', 104857600, admin_id),
      ('video/x-msvideo', 'avi', 'video', 'AVI video', 104857600, admin_id),
      ('video/x-matroska', 'mkv', 'video', 'Matroska video', 104857600, admin_id),
      ('video/webm', 'webm', 'video', 'WebM video', 104857600, admin_id),

    -- Audio
      ('audio/mpeg', 'mp3', 'audio', 'MP3 audio', 20971520, admin_id), -- 20MB
      ('audio/wav', 'wav', 'audio', 'WAV audio', 52428800, admin_id), -- 50MB
      ('audio/ogg', 'ogg', 'audio', 'OGG audio', 20971520, admin_id),
      ('audio/flac', 'flac', 'audio', 'FLAC audio', 52428800, admin_id),
      ('audio/aac', 'aac', 'audio', 'AAC audio', 20971520, admin_id),
      ('audio/mp4', 'm4a', 'audio', 'M4A audio', 20971520, admin_id),
      ('audio/webm', 'weba', 'audio', 'WebM audio', 20971520, admin_id)
    ON CONFLICT (mime_type, file_extension) DO NOTHING;
  END IF;
END $$;

-- =============================================================================
-- Comments for documentation
-- =============================================================================

COMMENT ON TABLE public.files IS 'Central file storage metadata for all plugins. Files are stored in plugin-scoped directories.';
COMMENT ON COLUMN public.files.plugin_id IS 'Plugin identifier that owns this file (e.g., content-manager, blog)';
COMMENT ON COLUMN public.files.filename IS 'Sanitized filename as stored on disk (includes random prefix)';
COMMENT ON COLUMN public.files.original_name IS 'Original filename as uploaded by user';
COMMENT ON COLUMN public.files.storage_path IS 'Relative path from upload root (e.g., content-manager/2025/11/abc123-image.jpg)';
COMMENT ON COLUMN public.files.storage_provider IS 'Storage backend: local, s3, gcs';
COMMENT ON COLUMN public.files.tags IS 'User-defined tags for organization and search';
COMMENT ON COLUMN public.files.deleted_at IS 'Soft delete timestamp. NULL = active file.';

COMMENT ON TABLE public.allowed_file_types IS 'Allowlist of permitted file types with configurable size limits';
COMMENT ON COLUMN public.allowed_file_types.max_file_size IS 'Maximum file size in bytes. NULL = no limit (use global default)';
COMMENT ON COLUMN public.allowed_file_types.category IS 'Broad file category for UI grouping and filtering';
