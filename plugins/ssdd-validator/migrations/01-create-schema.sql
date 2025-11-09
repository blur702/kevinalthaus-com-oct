-- Create schema for SSDD Validator plugin
-- This schema provides isolation for address validation, district mapping, and congressional representative data

-- Create the plugin schema
CREATE SCHEMA IF NOT EXISTS plugin_ssdd_validator;

-- Grant permissions to postgres role (adjust if using different application role)
GRANT USAGE, CREATE ON SCHEMA plugin_ssdd_validator TO postgres;

-- Set search path for subsequent operations
SET search_path TO plugin_ssdd_validator, public;

-- Create migration tracking table
CREATE TABLE IF NOT EXISTS plugin_ssdd_validator.plugin_migrations (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) UNIQUE NOT NULL,
  executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  description TEXT
);

COMMENT ON SCHEMA plugin_ssdd_validator IS 'Isolated schema for SSDD Validator plugin - address validation, district mapping, and congressional representative data';
COMMENT ON TABLE plugin_ssdd_validator.plugin_migrations IS 'Tracks executed migrations for SSDD Validator plugin';

-- Insert initial migration record
INSERT INTO plugin_ssdd_validator.plugin_migrations (migration_name, description)
VALUES ('01-create-schema', 'Initial schema creation for SSDD Validator plugin');
