-- Ensure PostGIS extension is available (required for geometry types)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'postgis'
  ) THEN
    -- Attempt to create extension if allowed; otherwise raise a clear error
    BEGIN
      CREATE EXTENSION IF NOT EXISTS postgis;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE EXCEPTION 'PostGIS extension is required. Please install/enable the postgis extension before running this migration.';
    END;
  END IF;
END$$;

-- Create districts table for congressional district boundaries from KML files
SET search_path TO plugin_ssdd_validator, public;

CREATE TABLE plugin_ssdd_validator.districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ssdd VARCHAR(10) UNIQUE NOT NULL,
  state VARCHAR(2) NOT NULL,
  district_number VARCHAR(10) NOT NULL,
  name VARCHAR(255) NOT NULL,
  boundary GEOMETRY(MultiPolygon, 4326) NOT NULL,
  kml_file_name VARCHAR(500),
  kml_file_path TEXT,
  area_sq_km NUMERIC(12, 2),
  centroid GEOMETRY(Point, 4326),
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT districts_state_check
    CHECK (state ~ '^[A-Z]{2}$'),
  CONSTRAINT districts_area_check
    CHECK (area_sq_km IS NULL OR area_sq_km > 0)
);

-- Indexes
CREATE INDEX idx_districts_boundary ON plugin_ssdd_validator.districts USING GIST(boundary);
CREATE INDEX idx_districts_centroid ON plugin_ssdd_validator.districts USING GIST(centroid);
CREATE UNIQUE INDEX idx_districts_ssdd ON plugin_ssdd_validator.districts(ssdd);
CREATE INDEX idx_districts_state ON plugin_ssdd_validator.districts(state);
CREATE INDEX idx_districts_state_district ON plugin_ssdd_validator.districts(state, district_number);

-- Trigger function for auto-updating updated_at timestamp
CREATE OR REPLACE FUNCTION plugin_ssdd_validator.update_district_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER districts_updated_at_trigger
  BEFORE UPDATE ON plugin_ssdd_validator.districts
  FOR EACH ROW
  EXECUTE FUNCTION plugin_ssdd_validator.update_district_timestamp();

-- Comments
COMMENT ON TABLE plugin_ssdd_validator.districts IS 'Stores congressional district boundaries from KML files with PostGIS geometry';
COMMENT ON COLUMN plugin_ssdd_validator.districts.ssdd IS 'State-State-District-District code (e.g., CA-12, TX-03)';
COMMENT ON COLUMN plugin_ssdd_validator.districts.state IS 'Two-letter state code';
COMMENT ON COLUMN plugin_ssdd_validator.districts.district_number IS 'District number (may include AL for at-large)';
COMMENT ON COLUMN plugin_ssdd_validator.districts.name IS 'Human-readable name (e.g., California 12th Congressional District)';
COMMENT ON COLUMN plugin_ssdd_validator.districts.boundary IS 'PostGIS multipolygon geometry in WGS84 (SRID 4326) from KML';
COMMENT ON COLUMN plugin_ssdd_validator.districts.area_sq_km IS 'Calculated area in square kilometers';
COMMENT ON COLUMN plugin_ssdd_validator.districts.centroid IS 'Calculated center point of district';
COMMENT ON COLUMN plugin_ssdd_validator.districts.metadata IS 'Additional KML metadata: description, styleUrl, etc.';

-- Insert migration tracking record
INSERT INTO plugin_ssdd_validator.plugin_migrations (migration_name, description)
VALUES ('03-create-districts-table', 'Create districts table with PostGIS geometry for KML boundary data');
