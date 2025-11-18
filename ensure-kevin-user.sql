-- Ensure kevin admin user exists with correct password
-- Password: (130Bpm)
-- Hash: $2b$12$FDllMpGmDc4dRRp2ruKzzOT8X/kQB.lfv0B9UXBCQYecvd0oMBw8u

-- First, try to update existing user
UPDATE users
SET password_hash = '$2b$12$FDllMpGmDc4dRRp2ruKzzOT8X/kQB.lfv0B9UXBCQYecvd0oMBw8u',
    role = 'admin',
    updated_at = NOW()
WHERE username = 'kevin';

-- If user doesn't exist (0 rows updated), insert new user
INSERT INTO users (id, email, username, password_hash, role, created_at, updated_at)
SELECT
    gen_random_uuid(),
    'kevin@kevinalthaus.com',
    'kevin',
    '$2b$12$FDllMpGmDc4dRRp2ruKzzOT8X/kQB.lfv0B9UXBCQYecvd0oMBw8u',
    'admin',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE username = 'kevin'
);

-- Display result
SELECT id, email, username, role, created_at
FROM users
WHERE username = 'kevin';
