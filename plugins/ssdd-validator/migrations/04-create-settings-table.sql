-- Create settings table for plugin-specific API key storage with encryption support
SET search_path TO plugin_ssdd_validator, public;

CREATE TABLE plugin_ssdd_validator.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) UNIQUE NOT NULL,
  value TEXT,
  vault_path TEXT,
  is_encrypted BOOLEAN NOT NULL DEFAULT true,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  is_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT settings_category_check
    CHECK (category IN ('usps', 'mapping', 'geocoding', 'civic_api', 'general')),
  CONSTRAINT settings_storage_check
    CHECK (((value IS NOT NULL AND vault_path IS NULL) OR (value IS NULL AND vault_path IS NOT NULL) OR (value IS NULL AND vault_path IS NULL)))
);

-- Indexes
CREATE UNIQUE INDEX idx_settings_key ON plugin_ssdd_validator.settings(key);
CREATE INDEX idx_settings_category ON plugin_ssdd_validator.settings(category);
CREATE INDEX idx_settings_required ON plugin_ssdd_validator.settings(is_required) WHERE is_required = true;

-- Comments
COMMENT ON TABLE plugin_ssdd_validator.settings IS 'Plugin-specific settings with encryption support and optional Vault integration';
COMMENT ON COLUMN plugin_ssdd_validator.settings.key IS 'Setting key (e.g., usps.consumer_key, google_maps.api_key)';
COMMENT ON COLUMN plugin_ssdd_validator.settings.value IS 'Encrypted value for sensitive keys, NULL if stored in vault_path';
COMMENT ON COLUMN plugin_ssdd_validator.settings.vault_path IS 'Vault path for highly sensitive keys';
COMMENT ON COLUMN plugin_ssdd_validator.settings.is_encrypted IS 'Indicates if value is encrypted';
COMMENT ON COLUMN plugin_ssdd_validator.settings.category IS 'Setting category: usps, mapping, geocoding, civic_api, general';
COMMENT ON COLUMN plugin_ssdd_validator.settings.is_required IS 'Indicates if setting is required for plugin operation';

-- Insert default setting placeholders with validated admin user
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM public.users WHERE email = 'admin@localhost' LIMIT 1;
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin user with email admin@localhost not found. Create the admin user before running this migration.';
  END IF;

  INSERT INTO plugin_ssdd_validator.settings (key, value, vault_path, category, description, is_required, created_by)
  VALUES
    ('usps.consumer_key', NULL, NULL, 'usps', 'USPS Web Tools API Consumer Key', true, admin_id),
    ('usps.consumer_secret', NULL, NULL, 'usps', 'USPS Web Tools API Consumer Secret', true, admin_id),
    ('usps.crid', NULL, NULL, 'usps', 'USPS CRID (Customer Registration ID)', true, admin_id),
    ('usps.mailer_ids', NULL, NULL, 'usps', 'USPS Mailer IDs (JSON array)', false, admin_id),
    ('google_maps.api_key', NULL, NULL, 'mapping', 'Google Maps API Key', false, admin_id),
    ('leaflet.api_key', NULL, NULL, 'mapping', 'Leaflet Tile Provider API Key', false, admin_id),
    ('census_geocoder.endpoint', 'https://geocoding.geo.census.gov/geocoder/', NULL, 'geocoding', 'US Census Bureau Geocoder Endpoint', false, admin_id),
    ('google_civic.api_key', NULL, NULL, 'civic_api', 'Google Civic Information API Key', false, admin_id);
END$$;

-- Insert migration tracking record
INSERT INTO plugin_ssdd_validator.plugin_migrations (migration_name, description)
VALUES ('04-create-settings-table', 'Create settings table for encrypted API key storage');

