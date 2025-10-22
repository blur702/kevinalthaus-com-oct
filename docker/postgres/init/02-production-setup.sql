-- ========================================
-- Production PostgreSQL Setup Script
-- ========================================
-- This script runs after 01-init.sql during first container startup
-- It sets up production-specific roles, permissions, indexes, and monitoring
-- ========================================

-- ----------------------------------------
-- CREATE PRODUCTION ROLES
-- ----------------------------------------

-- Create read-only monitoring role for health checks
-- Password must be provided via MONITORING_PASSWORD environment variable
DO $$
DECLARE
  monitoring_pass TEXT;
BEGIN
  monitoring_pass := current_setting('kevinalthaus.monitoring_password', true);
  IF monitoring_pass IS NULL OR monitoring_pass = '' THEN
    RAISE EXCEPTION 'MONITORING_PASSWORD environment variable must be set for production';
  END IF;
  EXECUTE format('CREATE ROLE monitoring WITH LOGIN PASSWORD %L', monitoring_pass);
END $$;
GRANT CONNECT ON DATABASE kevinalthaus TO monitoring;
GRANT USAGE ON SCHEMA public TO monitoring;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO monitoring;

-- Grant monitoring access to pg_stat views
GRANT pg_monitor TO monitoring;

-- Create application role with specific permissions (not using superuser)
-- Password must be provided via APP_USER_PASSWORD environment variable
DO $$
DECLARE
  app_user_pass TEXT;
BEGIN
  app_user_pass := current_setting('kevinalthaus.app_user_password', true);
  IF app_user_pass IS NULL OR app_user_pass = '' THEN
    RAISE EXCEPTION 'APP_USER_PASSWORD environment variable must be set for production';
  END IF;
  EXECUTE format('CREATE ROLE app_user WITH LOGIN PASSWORD %L', app_user_pass);
END $$;
GRANT CONNECT ON DATABASE kevinalthaus TO app_user;
GRANT USAGE, CREATE ON SCHEMA public TO app_user;

-- Grant permissions on all current tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- ----------------------------------------
-- SECURITY CONFIGURATION
-- ----------------------------------------

-- Revoke unnecessary permissions from public role
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE kevinalthaus FROM PUBLIC;

-- ----------------------------------------
-- PERFORMANCE INDEXES
-- ----------------------------------------

-- Create indexes on commonly queried columns for users table
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active) WHERE is_active = true;

-- Create indexes for refresh tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked_at ON refresh_tokens(revoked_at) WHERE revoked_at IS NULL;

-- Create indexes for plugin registry (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'plugin_registry') THEN
        CREATE INDEX IF NOT EXISTS idx_plugin_registry_name ON plugin_registry(name);
        CREATE INDEX IF NOT EXISTS idx_plugin_registry_status ON plugin_registry(status);
        CREATE INDEX IF NOT EXISTS idx_plugin_registry_created_at ON plugin_registry(created_at);
    END IF;
END $$;

-- Create indexes for audit log (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_log') THEN
        CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
        CREATE INDEX IF NOT EXISTS idx_audit_log_resource_type ON audit_log(resource_type);
    END IF;
END $$;

-- ----------------------------------------
-- MONITORING VIEWS
-- ----------------------------------------

-- Create view for database health monitoring
CREATE OR REPLACE VIEW v_database_health AS
SELECT
    datname AS database_name,
    numbackends AS active_connections,
    xact_commit AS transactions_committed,
    xact_rollback AS transactions_rolled_back,
    blks_read AS blocks_read,
    blks_hit AS blocks_hit,
    CASE
        WHEN (blks_read + blks_hit) > 0
        THEN ROUND(100.0 * blks_hit / (blks_read + blks_hit), 2)
        ELSE 0
    END AS cache_hit_ratio,
    tup_returned AS tuples_returned,
    tup_fetched AS tuples_fetched,
    tup_inserted AS tuples_inserted,
    tup_updated AS tuples_updated,
    tup_deleted AS tuples_deleted,
    conflicts AS conflicts,
    deadlocks AS deadlocks,
    stats_reset AS stats_reset_time
FROM pg_stat_database
WHERE datname = current_database();

-- Create view for connection monitoring
CREATE OR REPLACE VIEW v_connection_stats AS
SELECT
    COUNT(*) AS total_connections,
    COUNT(*) FILTER (WHERE state = 'active') AS active_connections,
    COUNT(*) FILTER (WHERE state = 'idle') AS idle_connections,
    COUNT(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_transaction,
    COUNT(*) FILTER (WHERE wait_event_type IS NOT NULL) AS waiting_connections,
    MAX(EXTRACT(EPOCH FROM (now() - query_start))) FILTER (WHERE query_start IS NOT NULL) AS longest_query_seconds,
    MAX(EXTRACT(EPOCH FROM (now() - state_change))) AS longest_idle_seconds
FROM pg_stat_activity
WHERE datname = current_database();

-- Create view for table sizes
CREATE OR REPLACE VIEW v_table_sizes AS
SELECT
    schemaname AS schema_name,
    tablename AS table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size,
    pg_total_relation_size(schemaname||'.'||tablename) AS total_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Create view for slow queries
CREATE OR REPLACE VIEW v_slow_queries AS
SELECT
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state,
    wait_event_type,
    wait_event
FROM pg_stat_activity
WHERE query_start IS NOT NULL
  AND (now() - pg_stat_activity.query_start) > interval '5 seconds'
  AND state != 'idle'
  AND datname = current_database()
ORDER BY duration DESC;

-- Grant monitoring views access to monitoring role
GRANT SELECT ON v_database_health TO monitoring;
GRANT SELECT ON v_connection_stats TO monitoring;
GRANT SELECT ON v_table_sizes TO monitoring;
GRANT SELECT ON v_slow_queries TO monitoring;

-- Grant default privileges for future tables to monitoring role
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES TO monitoring;

-- ----------------------------------------
-- MAINTENANCE CONFIGURATION
-- ----------------------------------------

-- Set autovacuum parameters for high-volume tables
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_log') THEN
        ALTER TABLE audit_log SET (autovacuum_vacuum_scale_factor = 0.05);
        ALTER TABLE audit_log SET (autovacuum_analyze_scale_factor = 0.02);
    END IF;
END $$;

-- Set autovacuum for refresh_tokens (frequently updated)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'refresh_tokens') THEN
        ALTER TABLE refresh_tokens SET (autovacuum_vacuum_scale_factor = 0.1);
        ALTER TABLE refresh_tokens SET (autovacuum_analyze_scale_factor = 0.05);
    END IF;
END $$;

-- ----------------------------------------
-- ENABLE QUERY STATISTICS
-- ----------------------------------------

-- Enable pg_stat_statements extension for query performance monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Reset statistics to start fresh
-- Wrap in DO block to handle case where pg_stat_statements is not in shared_preload_libraries
-- This allows the script to complete even if the extension was created but not properly loaded
DO $$
BEGIN
    PERFORM pg_stat_statements_reset();
EXCEPTION
    WHEN undefined_function THEN
        RAISE NOTICE 'pg_stat_statements_reset() not available - extension may not be in shared_preload_libraries';
END $$;

-- ----------------------------------------
-- PARTITION SETUP (Optional - for high volume tables)
-- ----------------------------------------

-- Example: Partition audit_log by month if expecting high volume
-- Uncomment and modify if needed
/*
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_log') THEN
        -- Create partitioned table
        CREATE TABLE audit_log_partitioned (
            LIKE audit_log INCLUDING ALL
        ) PARTITION BY RANGE (created_at);

        -- Create partitions for next 12 months
        FOR i IN 0..11 LOOP
            EXECUTE format(
                'CREATE TABLE audit_log_p%s PARTITION OF audit_log_partitioned
                FOR VALUES FROM (%L) TO (%L)',
                to_char(current_date + (i || ' months')::interval, 'YYYYMM'),
                date_trunc('month', current_date + (i || ' months')::interval),
                date_trunc('month', current_date + ((i+1) || ' months')::interval)
            );
        END LOOP;
    END IF;
END $$;
*/

-- ----------------------------------------
-- NOTIFICATIONS
-- ----------------------------------------

-- Log production setup completion
DO $$
BEGIN
    RAISE NOTICE 'Production setup completed successfully';
    RAISE NOTICE 'Roles created: monitoring, app_user';
    RAISE NOTICE 'Performance indexes created';
    RAISE NOTICE 'Monitoring views created: v_database_health, v_connection_stats, v_table_sizes, v_slow_queries';
    RAISE NOTICE 'IMPORTANT: Change default passwords for monitoring and app_user roles!';
END $$;

-- ========================================
-- END OF PRODUCTION SETUP
-- ========================================
