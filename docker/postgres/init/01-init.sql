-- PostgreSQL initialization script
-- This script runs on first container startup

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schemas for plugin isolation
-- Plugins will create their own schemas with naming convention: plugin_<pluginname>

-- Optional: Create a monitoring user
-- CREATE ROLE monitor WITH LOGIN PASSWORD 'monitor_password';
-- GRANT pg_monitor TO monitor;
