-- Create member_sync_log table for tracking congressional member data synchronization
SET search_path TO plugin_ssdd_validator, public;

CREATE TABLE plugin_ssdd_validator.member_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sync_completed_at TIMESTAMP,
  sync_status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
  records_fetched INTEGER DEFAULT 0,
  records_added INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_unchanged INTEGER DEFAULT 0,
  changes_detected JSONB,
  backup_file_path TEXT,
  source_url TEXT NOT NULL DEFAULT 'https://housegovfeeds.house.gov/feeds/Member/Json',
  error_message TEXT,
  error_stack TEXT,
  duration_seconds INTEGER,
  triggered_by VARCHAR(50) NOT NULL,
  triggered_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT member_sync_log_status_check
    CHECK (sync_status IN ('in_progress', 'completed', 'failed', 'partial')),
  CONSTRAINT member_sync_log_triggered_by_check
    CHECK (triggered_by IN ('scheduled', 'manual', 'system')),
  CONSTRAINT member_sync_log_records_fetched_check
    CHECK (records_fetched >= 0),
  CONSTRAINT member_sync_log_records_added_check
    CHECK (records_added >= 0),
  CONSTRAINT member_sync_log_records_updated_check
    CHECK (records_updated >= 0),
  CONSTRAINT member_sync_log_records_unchanged_check
    CHECK (records_unchanged >= 0),
  CONSTRAINT member_sync_log_duration_check
    CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
);

-- Indexes
CREATE INDEX idx_member_sync_log_started_at ON plugin_ssdd_validator.member_sync_log(sync_started_at DESC);
CREATE INDEX idx_member_sync_log_status ON plugin_ssdd_validator.member_sync_log(sync_status);
CREATE INDEX idx_member_sync_log_failed ON plugin_ssdd_validator.member_sync_log(sync_started_at DESC) WHERE sync_status = 'failed';
CREATE INDEX idx_member_sync_log_user ON plugin_ssdd_validator.member_sync_log(triggered_by_user_id) WHERE triggered_by_user_id IS NOT NULL;

-- Comments
COMMENT ON TABLE plugin_ssdd_validator.member_sync_log IS 'Tracks congressional member data synchronization from housegovfeeds.house.gov';
COMMENT ON COLUMN plugin_ssdd_validator.member_sync_log.sync_status IS 'Status: in_progress, completed, failed, partial';
COMMENT ON COLUMN plugin_ssdd_validator.member_sync_log.records_fetched IS 'Total records fetched from API';
COMMENT ON COLUMN plugin_ssdd_validator.member_sync_log.records_added IS 'Number of new records added';
COMMENT ON COLUMN plugin_ssdd_validator.member_sync_log.records_updated IS 'Number of existing records updated';
COMMENT ON COLUMN plugin_ssdd_validator.member_sync_log.records_unchanged IS 'Number of records that remained unchanged';
COMMENT ON COLUMN plugin_ssdd_validator.member_sync_log.changes_detected IS 'JSONB array of change objects: {ssdd, field, old_value, new_value}';
COMMENT ON COLUMN plugin_ssdd_validator.member_sync_log.backup_file_path IS 'Path to backup JSON file before update (e.g., media/member-info/backup/members-2025-11-06-14-30-00.json)';
COMMENT ON COLUMN plugin_ssdd_validator.member_sync_log.triggered_by IS 'How sync was initiated: scheduled, manual, system';
COMMENT ON COLUMN plugin_ssdd_validator.member_sync_log.duration_seconds IS 'Total duration of sync operation in seconds';

-- Insert migration tracking record
INSERT INTO plugin_ssdd_validator.plugin_migrations (migration_name, description)
VALUES ('05-create-member-sync-log-table', 'Create member sync log table for tracking congressional data updates');
