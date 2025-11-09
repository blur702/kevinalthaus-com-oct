-- Create addresses table for validated addresses with geocoding data
SET search_path TO plugin_ssdd_validator, public;

CREATE TABLE plugin_ssdd_validator.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_address TEXT NOT NULL,
  validated_address TEXT,
  street_address VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(2),
  zip_code VARCHAR(10),
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  location GEOMETRY(Point, 4326),
  validation_status VARCHAR(50) NOT NULL,
  validation_source VARCHAR(50),
  alternative_addresses JSONB,
  district_id UUID NULL,
  validated_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT addresses_validation_status_check
    CHECK (validation_status IN ('valid', 'invalid', 'alternative_suggested', 'pending')),
  CONSTRAINT addresses_latitude_check
    CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  CONSTRAINT addresses_longitude_check
    CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180))
);

-- Trigger function to auto-update updated_at
CREATE OR REPLACE FUNCTION plugin_ssdd_validator.update_address_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER addresses_updated_at_trigger
  BEFORE UPDATE ON plugin_ssdd_validator.addresses
  FOR EACH ROW
  EXECUTE FUNCTION plugin_ssdd_validator.update_address_timestamp();

-- Indexes
CREATE INDEX idx_addresses_location ON plugin_ssdd_validator.addresses USING GIST(location);
CREATE INDEX idx_addresses_zip_code ON plugin_ssdd_validator.addresses(zip_code);
CREATE INDEX idx_addresses_state ON plugin_ssdd_validator.addresses(state);
CREATE INDEX idx_addresses_validation_status ON plugin_ssdd_validator.addresses(validation_status);
CREATE INDEX idx_addresses_created_by ON plugin_ssdd_validator.addresses(created_by);
CREATE INDEX idx_addresses_created_at ON plugin_ssdd_validator.addresses(created_at DESC);

-- Comments
COMMENT ON TABLE plugin_ssdd_validator.addresses IS 'Stores validated addresses with geocoding data and PostGIS geometry';
COMMENT ON COLUMN plugin_ssdd_validator.addresses.original_address IS 'User-provided address before validation';
COMMENT ON COLUMN plugin_ssdd_validator.addresses.validated_address IS 'USPS-validated address';
COMMENT ON COLUMN plugin_ssdd_validator.addresses.location IS 'PostGIS point geometry in WGS84 (SRID 4326) for spatial queries';
COMMENT ON COLUMN plugin_ssdd_validator.addresses.validation_status IS 'Status of address validation: valid, invalid, alternative_suggested, pending';
COMMENT ON COLUMN plugin_ssdd_validator.addresses.validation_source IS 'Source of validation: usps, google_geocoder, census_geocoder';
COMMENT ON COLUMN plugin_ssdd_validator.addresses.alternative_addresses IS 'JSONB array of suggested addresses when validation fails';
COMMENT ON COLUMN plugin_ssdd_validator.addresses.district_id IS 'Foreign key to districts table (added after districts table is created)';

-- Insert migration tracking record
INSERT INTO plugin_ssdd_validator.plugin_migrations (migration_name, description)
VALUES ('02-create-addresses-table', 'Create addresses table with PostGIS geometry for geocoded locations');
