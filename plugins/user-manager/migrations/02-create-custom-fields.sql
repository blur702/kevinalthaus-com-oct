-- Custom user fields table for extensible user properties
-- This allows storing additional user metadata without modifying core schema

SET search_path TO plugin_user_manager, public;

CREATE TABLE IF NOT EXISTS plugin_user_manager.user_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- References public.users(id)
  field_data JSONB NOT NULL DEFAULT '{}', -- Flexible JSON storage for custom fields
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID, -- Admin who created these fields
  updated_by UUID, -- Admin who last updated these fields

  -- Ensure one record per user
  CONSTRAINT user_custom_fields_user_id_unique UNIQUE (user_id)
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_user_custom_fields_user_id
  ON plugin_user_manager.user_custom_fields (user_id);

-- GIN index for JSONB queries on custom fields
CREATE INDEX IF NOT EXISTS idx_user_custom_fields_field_data
  ON plugin_user_manager.user_custom_fields USING GIN (field_data);

-- Index for tracking who made changes
CREATE INDEX IF NOT EXISTS idx_user_custom_fields_updated_by
  ON plugin_user_manager.user_custom_fields (updated_by);

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION plugin_user_manager.update_custom_fields_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_custom_fields_timestamp
  BEFORE UPDATE ON plugin_user_manager.user_custom_fields
  FOR EACH ROW
  EXECUTE FUNCTION plugin_user_manager.update_custom_fields_timestamp();

-- Comment for documentation
COMMENT ON TABLE plugin_user_manager.user_custom_fields IS
  'Stores extensible custom fields for users without modifying core schema. Use JSONB for flexible key-value storage.';

COMMENT ON COLUMN plugin_user_manager.user_custom_fields.field_data IS
  'JSONB column storing custom user attributes. Example: {"department": "Engineering", "employeeId": "E12345", "startDate": "2024-01-15"}';

-- Insert migration record
INSERT INTO plugin_user_manager.plugin_migrations (migration_name)
VALUES ('02-create-custom-fields')
ON CONFLICT (migration_name) DO NOTHING;
