-- Create taxonomy plugin schema
CREATE SCHEMA IF NOT EXISTS plugin_taxonomy;

-- Grant permissions (postgres role only for security)
GRANT USAGE ON SCHEMA plugin_taxonomy TO postgres;
GRANT CREATE ON SCHEMA plugin_taxonomy TO postgres;

-- Create migrations tracking table
CREATE TABLE IF NOT EXISTS plugin_taxonomy.plugin_migrations (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Track this migration
INSERT INTO plugin_taxonomy.plugin_migrations (migration_name, description)
VALUES ('01-create-schema', 'Initialize taxonomy plugin schema')
ON CONFLICT (migration_name) DO NOTHING;
