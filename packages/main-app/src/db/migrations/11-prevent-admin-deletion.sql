-- Migration: Prevent deletion of permanent admin user (kevin)
-- This trigger prevents accidental or malicious deletion of the root admin account

CREATE OR REPLACE FUNCTION prevent_admin_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.username = 'kevin' AND OLD.role = 'admin' THEN
    RAISE EXCEPTION 'Cannot delete permanent admin user (kevin)';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists to make migration idempotent
DROP TRIGGER IF EXISTS prevent_kevin_deletion ON users;

CREATE TRIGGER prevent_kevin_deletion
BEFORE DELETE ON users
FOR EACH ROW
EXECUTE FUNCTION prevent_admin_deletion();
