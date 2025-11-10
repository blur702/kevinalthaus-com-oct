-- 05-create-form-builder-tables.sql
-- Title: Create form builder infrastructure (forms, form_submissions, form_templates)
-- Description: Adds core tables, enums, indexes, and triggers to support the form builder.

SET search_path TO plugin_page_builder, public;

-- ============================================================
-- Enums
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'form_status') THEN
    CREATE TYPE form_status AS ENUM ('draft', 'published', 'archived');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'submission_status') THEN
    CREATE TYPE submission_status AS ENUM ('pending', 'processed', 'spam', 'deleted');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'template_type') THEN
    CREATE TYPE template_type AS ENUM ('email', 'confirmation');
  END IF;
END$$;

COMMENT ON TYPE form_status IS 'Form publication lifecycle: draft, published, archived.';
COMMENT ON TYPE submission_status IS 'Submission processing state: pending, processed, spam, deleted.';
COMMENT ON TYPE template_type IS 'Template category for form notifications: email or confirmation.';

-- ============================================================
-- Tables
-- ============================================================

-- Forms
CREATE TABLE IF NOT EXISTS forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL CHECK (char_length(name) > 0 AND char_length(name) <= 255),
  slug VARCHAR(255) NOT NULL CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 1000),
  fields_json JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(fields_json) = 'object'),
  settings_json JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(settings_json) = 'object'),
  status form_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE forms IS 'Form definitions with fields and settings. Soft-delete enabled via deleted_at/deleted_by.';
COMMENT ON COLUMN forms.name IS 'Human-readable form name (1-255 chars).';
COMMENT ON COLUMN forms.slug IS 'URL-safe unique slug for routing (lowercase, hyphen-separated).';
COMMENT ON COLUMN forms.description IS 'Optional description (<= 1000 chars).';
COMMENT ON COLUMN forms.fields_json IS 'JSONB object of field definitions (schema enforced to object).';
COMMENT ON COLUMN forms.settings_json IS 'JSONB object of form-level settings (notifications, redirects, etc.).';
COMMENT ON COLUMN forms.status IS 'Publication status of the form.';
COMMENT ON COLUMN forms.created_by IS 'FK to public.users(id) that created the form.';
COMMENT ON COLUMN forms.updated_by IS 'FK to public.users(id) that last updated the form.';
COMMENT ON COLUMN forms.deleted_at IS 'Soft-delete timestamp. When set, exclude from unique constraints.';
COMMENT ON COLUMN forms.deleted_by IS 'User who performed soft-delete.';

-- Form submissions
CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  submission_data JSONB NOT NULL CHECK (jsonb_typeof(submission_data) = 'object'),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  status submission_status NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMPTZ
);

COMMENT ON TABLE form_submissions IS 'Concrete submissions for a given form. Can be anonymous (user_id NULL).';
COMMENT ON COLUMN form_submissions.form_id IS 'FK to forms(id). CASCADE delete to remove dependent submissions.';
COMMENT ON COLUMN form_submissions.submission_data IS 'Submitted key/value pairs (JSONB object).';
COMMENT ON COLUMN form_submissions.user_id IS 'Optional FK to public.users(id) if an authenticated user submitted the form.';
COMMENT ON COLUMN form_submissions.ip_address IS 'Submitter IP address for abuse/spam prevention.';
COMMENT ON COLUMN form_submissions.user_agent IS 'Submitter user agent string.';
COMMENT ON COLUMN form_submissions.status IS 'Processing state for triage workflows.';
COMMENT ON COLUMN form_submissions.submitted_at IS 'Timestamp when submission was created.';
COMMENT ON COLUMN form_submissions.processed_at IS 'When submission moved out of pending (processed/spam/etc.).';

-- Form templates
CREATE TABLE IF NOT EXISTS form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  type template_type NOT NULL,
  name VARCHAR(255) NOT NULL CHECK (char_length(name) > 0 AND char_length(name) <= 255),
  subject VARCHAR(500),
  body_template TEXT NOT NULL,
  settings_json JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(settings_json) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE form_templates IS 'Templates associated with forms (e.g. email notifications, confirmations).';
COMMENT ON COLUMN form_templates.type IS 'Template type: email (for outbound email), confirmation (onscreen response).';
COMMENT ON COLUMN form_templates.name IS 'Template name (1-255 chars).';
COMMENT ON COLUMN form_templates.subject IS 'Optional subject for email templates (<= 500 chars).';
COMMENT ON COLUMN form_templates.body_template IS 'Template body with variable placeholders.';
COMMENT ON COLUMN form_templates.settings_json IS 'Template-specific settings (e.g., recipients, cc, bcc).';
COMMENT ON COLUMN form_templates.created_by IS 'Creator of this template (FK to users).';
COMMENT ON COLUMN form_templates.updated_by IS 'Last updater (FK to users).';
COMMENT ON COLUMN form_templates.deleted_at IS 'Soft-delete timestamp.';
COMMENT ON COLUMN form_templates.deleted_by IS 'User who performed soft-delete.';

-- ============================================================
-- Indexes
-- ============================================================

-- Forms indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_forms_slug_unique ON forms (slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_forms_status ON forms (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_forms_created_by ON forms (created_by);
CREATE INDEX IF NOT EXISTS idx_forms_deleted_at ON forms (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_forms_fields_json ON forms USING GIN (fields_json);
CREATE INDEX IF NOT EXISTS idx_forms_settings_json ON forms USING GIN (settings_json);
CREATE INDEX IF NOT EXISTS idx_forms_search ON forms USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Form submissions indexes
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_id ON form_submissions (form_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_user_id ON form_submissions (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_form_submissions_status ON form_submissions (status);
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_at ON form_submissions (submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_date ON form_submissions (form_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_form_submissions_data ON form_submissions USING GIN (submission_data);
CREATE INDEX IF NOT EXISTS idx_form_submissions_ip ON form_submissions (ip_address);

-- Form templates indexes
CREATE INDEX IF NOT EXISTS idx_form_templates_form_id ON form_templates (form_id);
CREATE INDEX IF NOT EXISTS idx_form_templates_type ON form_templates (type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_form_templates_form_type ON form_templates (form_id, type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_form_templates_deleted_at ON form_templates (deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================
-- Triggers: update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_form_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_form_timestamp ON forms;
CREATE TRIGGER trigger_update_form_timestamp
BEFORE UPDATE ON forms
FOR EACH ROW
EXECUTE FUNCTION update_form_timestamp();

CREATE OR REPLACE FUNCTION update_form_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_form_template_timestamp ON form_templates;
CREATE TRIGGER trigger_update_form_template_timestamp
BEFORE UPDATE ON form_templates
FOR EACH ROW
EXECUTE FUNCTION update_form_template_timestamp();

COMMENT ON FUNCTION update_form_timestamp() IS 'BEFORE UPDATE trigger function to maintain updated_at on forms.';
COMMENT ON FUNCTION update_form_template_timestamp() IS 'BEFORE UPDATE trigger function to maintain updated_at on form_templates.';

-- ============================================================
-- Migration tracking
-- ============================================================

INSERT INTO plugin_page_builder.plugin_migrations (migration_name, description)
VALUES (
  '05-create-form-builder-tables',
  'Form builder tables with forms, submissions, templates, JSONB storage, and advanced query indexes'
)
ON CONFLICT (migration_name) DO NOTHING;

