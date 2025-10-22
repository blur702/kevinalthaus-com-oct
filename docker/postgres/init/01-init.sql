-- PostgreSQL initialization script
-- This script runs on first container startup

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schemas for plugin isolation
-- Plugins will create their own schemas with naming convention: plugin_<pluginname>

-- Optional: Create a monitoring user
-- Two approaches to enable this:
--
-- (a) Set a custom PostgreSQL parameter via postgresql.conf or ALTER SYSTEM:
--     ALTER SYSTEM SET monitor.password = 'your_secure_password';
--     Then reload configuration and uncomment the code below.
--     Note: current_setting('monitor.password', true) reads PostgreSQL config, NOT OS env vars.
--
-- (b) Use an external init script (shell/psql) that reads an environment variable:
--     #!/bin/bash
--     docker exec postgres psql -U postgres -c "CREATE ROLE monitor WITH LOGIN PASSWORD '$MONITOR_PASSWORD';"
--     docker exec postgres psql -U postgres -c "GRANT pg_monitor TO monitor;"
--     This approach is recommended for container deployments using docker-compose env files.
--
-- Uncomment below if using approach (a):
-- DO $$
-- BEGIN
--   IF current_setting('monitor.password', true) IS NOT NULL THEN
--     EXECUTE format('CREATE ROLE monitor WITH LOGIN PASSWORD %L', current_setting('monitor.password'));
--     GRANT pg_monitor TO monitor;
--   END IF;
-- END $$;
