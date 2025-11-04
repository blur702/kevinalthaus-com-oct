-- Migration 09: Vault Integration for Sensitive Settings
-- Add vault_path column to system_settings table to support Vault-based secret storage
-- Add api_keys table with vault_path for secure API key storage

-- Add vault_path column to system_settings
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS vault_path TEXT;

COMMENT ON COLUMN system_settings.vault_path IS 'Vault path for encrypted sensitive settings (e.g., secret/email/brevo)';

-- Create api_keys table for API key management
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(20) NOT NULL UNIQUE, -- First 10 chars for identification
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  vault_path TEXT NOT NULL, -- Path to full key in Vault
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for api_keys table
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at) WHERE expires_at IS NOT NULL;

-- Add comments
COMMENT ON TABLE api_keys IS 'API keys for programmatic access - full keys stored in Vault';
COMMENT ON COLUMN api_keys.id IS 'Unique identifier for API key';
COMMENT ON COLUMN api_keys.user_id IS 'User who created the API key';
COMMENT ON COLUMN api_keys.name IS 'Human-readable name for the API key';
COMMENT ON COLUMN api_keys.key_prefix IS 'First 10 characters of the API key for identification';
COMMENT ON COLUMN api_keys.scopes IS 'JSON array of permission scopes (read, write, admin, etc.)';
COMMENT ON COLUMN api_keys.vault_path IS 'Vault path where full API key is stored';
COMMENT ON COLUMN api_keys.last_used_at IS 'Last time this API key was used';
COMMENT ON COLUMN api_keys.expires_at IS 'Expiration timestamp (NULL = never expires)';

-- Create audit_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id TEXT,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);

-- Add comments
COMMENT ON TABLE audit_log IS 'Audit trail for sensitive operations';
COMMENT ON COLUMN audit_log.action IS 'Action performed (CREATE, UPDATE, DELETE, etc.)';
COMMENT ON COLUMN audit_log.resource_type IS 'Type of resource affected (settings, api_key, user, etc.)';
COMMENT ON COLUMN audit_log.resource_id IS 'Identifier of the affected resource';
COMMENT ON COLUMN audit_log.details IS 'JSON details of the operation';

-- Insert initial Vault-related settings
INSERT INTO system_settings (key, value, description, updated_at)
VALUES
  ('email.brevo_api_key_vault_path', '"secret/email/brevo"', 'Vault path for Brevo API key', CURRENT_TIMESTAMP),
  ('security.password_policy', '{
    "minLength": 12,
    "requireUppercase": true,
    "requireLowercase": true,
    "requireNumbers": true,
    "requireSpecial": true,
    "maxLength": 128,
    "preventReuse": 3
  }', 'Password policy enforced by auth system', CURRENT_TIMESTAMP),
  ('security.jwt_config', '{
    "accessTokenExpiry": "15m",
    "refreshTokenExpiryDays": 30,
    "issuer": "kevinalthaus-com",
    "audience": "kevinalthaus-com"
  }', 'JWT configuration for authentication', CURRENT_TIMESTAMP),
  ('security.session_config', '{
    "timeout": 30,
    "absoluteTimeout": 480,
    "slidingExpiration": true
  }', 'Session timeout configuration', CURRENT_TIMESTAMP),
  ('security.login_security', '{
    "maxAttempts": 5,
    "lockoutDuration": 15,
    "resetAfterSuccess": true
  }', 'Login attempt security configuration', CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 09: Vault integration completed successfully';
  RAISE NOTICE '  - Added vault_path column to system_settings';
  RAISE NOTICE '  - Created api_keys table with Vault integration';
  RAISE NOTICE '  - Created audit_log table for security tracking';
  RAISE NOTICE '  - Inserted default security settings';
END $$;
