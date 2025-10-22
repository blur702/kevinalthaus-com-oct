-- PostgreSQL initialization script
-- This script runs on first container startup

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schemas for plugin isolation
-- Plugins will create their own schemas with naming convention: plugin_<pluginname>

-- Optional: Create a monitoring user
-- To enable, set MONITOR_PASSWORD environment variable and uncomment:
-- DO $$
-- BEGIN
--   IF current_setting('monitor.password', true) IS NOT NULL THEN
--     EXECUTE format('CREATE ROLE monitor WITH LOGIN PASSWORD %L', current_setting('monitor.password'));
--     GRANT pg_monitor TO monitor;
--   END IF;
-- END $$;
