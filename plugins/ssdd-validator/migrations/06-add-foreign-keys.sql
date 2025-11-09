-- Add foreign key relationships between addresses and districts
SET search_path TO plugin_ssdd_validator, public;

-- Add foreign key constraint from addresses to districts
-- This relationship is added after both tables are created
-- Addresses are linked to districts after geocoding and point-in-polygon analysis
ALTER TABLE plugin_ssdd_validator.addresses
  ADD CONSTRAINT addresses_district_id_fkey
  FOREIGN KEY (district_id)
  REFERENCES plugin_ssdd_validator.districts(id)
  ON DELETE SET NULL;

-- Create index on the foreign key for better query performance
CREATE INDEX idx_addresses_district_id
  ON plugin_ssdd_validator.addresses(district_id)
  WHERE district_id IS NOT NULL;

-- Comments
COMMENT ON CONSTRAINT addresses_district_id_fkey ON plugin_ssdd_validator.addresses IS 'Links addresses to their congressional district after geocoding and spatial analysis';

-- Insert migration tracking record
INSERT INTO plugin_ssdd_validator.plugin_migrations (migration_name, description)
VALUES ('06-add-foreign-keys', 'Add foreign key relationships between addresses and districts');
