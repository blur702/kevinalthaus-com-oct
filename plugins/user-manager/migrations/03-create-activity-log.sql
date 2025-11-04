-- Activity and audit logging tables for comprehensive user tracking

SET search_path TO plugin_user_manager, public;

-- User activity log table
-- Tracks user actions and system events related to user accounts
CREATE TABLE IF NOT EXISTS plugin_user_manager.user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- User who performed/triggered the activity
  activity_type plugin_user_manager.activity_type NOT NULL,
  description TEXT, -- Human-readable description
  metadata JSONB DEFAULT '{}', -- Additional context (IP address, user agent, etc.)
  ip_address INET, -- IP address of the user
  user_agent TEXT, -- Browser/client user agent
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Optional: link to related entities
  related_user_id UUID, -- For actions affecting other users
  session_id VARCHAR(255) -- Session identifier for grouping related activities
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id
  ON plugin_user_manager.user_activity_log (user_id);

CREATE INDEX IF NOT EXISTS idx_activity_log_activity_type
  ON plugin_user_manager.user_activity_log (activity_type);

CREATE INDEX IF NOT EXISTS idx_activity_log_created_at
  ON plugin_user_manager.user_activity_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_related_user
  ON plugin_user_manager.user_activity_log (related_user_id)
  WHERE related_user_id IS NOT NULL;

-- GIN index for JSONB metadata queries
CREATE INDEX IF NOT EXISTS idx_activity_log_metadata
  ON plugin_user_manager.user_activity_log USING GIN (metadata);

-- Audit log table for administrative actions
-- Tracks who did what, when, and why
CREATE TABLE IF NOT EXISTS plugin_user_manager.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL, -- Admin/user who performed the action
  action plugin_user_manager.audit_action NOT NULL,
  resource_type VARCHAR(100) NOT NULL, -- e.g., 'user', 'custom_field', 'bulk_import'
  resource_id VARCHAR(255), -- ID of the affected resource
  details JSONB DEFAULT '{}', -- Action details, changes made, etc.
  reason TEXT, -- Optional justification for the action
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Optional: link to activity log entry
  activity_log_id UUID REFERENCES plugin_user_manager.user_activity_log(id)
);

-- Indexes for audit log
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id
  ON plugin_user_manager.audit_log (actor_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_action
  ON plugin_user_manager.audit_log (action);

CREATE INDEX IF NOT EXISTS idx_audit_log_resource
  ON plugin_user_manager.audit_log (resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON plugin_user_manager.audit_log (created_at DESC);

-- GIN index for JSONB details queries
CREATE INDEX IF NOT EXISTS idx_audit_log_details
  ON plugin_user_manager.audit_log USING GIN (details);

-- Function to automatically create audit log entries from activity log
CREATE OR REPLACE FUNCTION plugin_user_manager.create_audit_from_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create audit entries for significant activities
  IF NEW.activity_type IN ('role_change', 'account_deleted', 'account_suspended',
                            'permission_change', 'bulk_operation') THEN
    INSERT INTO plugin_user_manager.audit_log (
      actor_id,
      action,
      resource_type,
      resource_id,
      details,
      ip_address,
      user_agent,
      activity_log_id
    ) VALUES (
      NEW.user_id,
      CASE NEW.activity_type
        WHEN 'role_change' THEN 'update'::plugin_user_manager.audit_action
        WHEN 'account_deleted' THEN 'delete'::plugin_user_manager.audit_action
        WHEN 'bulk_operation' THEN 'bulk_import'::plugin_user_manager.audit_action
        ELSE 'security_event'::plugin_user_manager.audit_action
      END,
      'user',
      COALESCE(NEW.related_user_id::TEXT, NEW.user_id::Text),
      jsonb_build_object(
        'activity_type', NEW.activity_type::TEXT,
        'description', NEW.description,
        'metadata', NEW.metadata
      ),
      NEW.ip_address,
      NEW.user_agent,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_audit_from_activity
  AFTER INSERT ON plugin_user_manager.user_activity_log
  FOR EACH ROW
  EXECUTE FUNCTION plugin_user_manager.create_audit_from_activity();

-- Comments for documentation
COMMENT ON TABLE plugin_user_manager.user_activity_log IS
  'Tracks user activities and system events. Use for user behavior analytics and security monitoring.';

COMMENT ON TABLE plugin_user_manager.audit_log IS
  'Administrative audit trail for compliance and security. Records who performed what actions on which resources.';

-- Insert migration record
INSERT INTO plugin_user_manager.plugin_migrations (migration_name)
VALUES ('03-create-activity-log')
ON CONFLICT (migration_name) DO NOTHING;
