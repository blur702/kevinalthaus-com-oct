-- Create members table for congressional representative information
SET search_path TO plugin_ssdd_validator, public;

CREATE TABLE plugin_ssdd_validator.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NULL REFERENCES plugin_ssdd_validator.districts(id) ON DELETE SET NULL,
  ssdd VARCHAR(10) NOT NULL,
  member_id VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  party VARCHAR(50),
  state VARCHAR(2) NOT NULL,
  district_number VARCHAR(10) NOT NULL,
  office_address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  website_url TEXT,
  twitter_handle VARCHAR(100),
  facebook_url TEXT,
  youtube_url TEXT,
  committee_assignments JSONB,
  leadership_position VARCHAR(255),
  term_start_date DATE,
  term_end_date DATE,
  photo_url TEXT,
  bio TEXT,
  raw_data JSONB,
  last_synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_members_ssdd ON plugin_ssdd_validator.members(ssdd);
CREATE INDEX idx_members_district_id ON plugin_ssdd_validator.members(district_id);
CREATE INDEX idx_members_state ON plugin_ssdd_validator.members(state);
CREATE INDEX idx_members_party ON plugin_ssdd_validator.members(party);
CREATE INDEX idx_members_state_district ON plugin_ssdd_validator.members(state, district_number);
CREATE INDEX idx_members_last_synced ON plugin_ssdd_validator.members(last_synced_at DESC);

-- Trigger function for auto-updating updated_at timestamp
CREATE OR REPLACE FUNCTION plugin_ssdd_validator.update_member_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER members_updated_at_trigger
  BEFORE UPDATE ON plugin_ssdd_validator.members
  FOR EACH ROW
  EXECUTE FUNCTION plugin_ssdd_validator.update_member_timestamp();

-- Comments
COMMENT ON TABLE plugin_ssdd_validator.members IS 'Stores congressional representative information synchronized from housegovfeeds.house.gov';
COMMENT ON COLUMN plugin_ssdd_validator.members.district_id IS 'Foreign key to districts table';
COMMENT ON COLUMN plugin_ssdd_validator.members.ssdd IS 'State-State-District-District code matching districts.ssdd';
COMMENT ON COLUMN plugin_ssdd_validator.members.member_id IS 'External ID from House API';
COMMENT ON COLUMN plugin_ssdd_validator.members.party IS 'Political party affiliation (e.g., Republican, Democrat, Independent)';
COMMENT ON COLUMN plugin_ssdd_validator.members.committee_assignments IS 'JSONB array of committee objects';
COMMENT ON COLUMN plugin_ssdd_validator.members.leadership_position IS 'Leadership role if applicable (e.g., Speaker, Majority Leader)';
COMMENT ON COLUMN plugin_ssdd_validator.members.raw_data IS 'Complete JSON from House API for future extensibility';
COMMENT ON COLUMN plugin_ssdd_validator.members.last_synced_at IS 'Timestamp of last data synchronization from House API';

-- Insert migration tracking record
INSERT INTO plugin_ssdd_validator.plugin_migrations (migration_name, description)
VALUES ('07-create-members-table', 'Create members table for congressional representative data');

-- Validation constraints
ALTER TABLE plugin_ssdd_validator.members
  ADD CONSTRAINT members_ssdd_format_check CHECK (ssdd ~ '^[A-Z]{2}-(0[1-9]|[1-9][0-9]|AL)$'),
  ADD CONSTRAINT members_state_format_check CHECK (state ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT members_ssdd_unique UNIQUE (ssdd);
