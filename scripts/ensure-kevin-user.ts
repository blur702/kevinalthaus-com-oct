import { Pool } from 'pg';
import { hashPassword } from '@monorepo/shared';

interface AdminUserRow {
  id: string;
  email: string;
  username: string;
  role: string;
}

async function ensureKevinUser(): Promise<void> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:changeme_secure_password@localhost:55432/kevinalthaus',
  });

  try {
    const password = '(130Bpm)';
    const hashedPassword = await hashPassword(password);

    // Check if kevin user already exists
    const existingUser = await pool.query<AdminUserRow>(
      'SELECT id, email, username, role FROM users WHERE username = $1',
      ['kevin']
    );

    if (existingUser.rows.length > 0) {
      // Update existing user's password
      await pool.query(
        'UPDATE users SET password_hash = $1, role = $2, updated_at = NOW() WHERE username = $3',
        [hashedPassword, 'admin', 'kevin']
      );

      const user = existingUser.rows[0];
      // eslint-disable-next-line no-console
      console.log('✓ Admin user password updated successfully:');
      // eslint-disable-next-line no-console
      console.log('  Email:', user.email);
      // eslint-disable-next-line no-console
      console.log('  Username:', user.username);
      // eslint-disable-next-line no-console
      console.log('  Role:', user.role);
      // eslint-disable-next-line no-console
      console.log('  ID:', user.id);
    } else {
      // Create new admin user
      const result = await pool.query<AdminUserRow>(
        `INSERT INTO users (id, email, username, password_hash, role, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
         RETURNING id, email, username, role`,
        ['kevin@kevinalthaus.com', 'kevin', hashedPassword, 'admin']
      );

      const adminUser = result.rows[0];
      // eslint-disable-next-line no-console
      console.log('✓ Admin user created successfully:');
      // eslint-disable-next-line no-console
      console.log('  Email:', adminUser.email);
      // eslint-disable-next-line no-console
      console.log('  Username:', adminUser.username);
      // eslint-disable-next-line no-console
      console.log('  Role:', adminUser.role);
      // eslint-disable-next-line no-console
      console.log('  ID:', adminUser.id);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('✗ Error ensuring kevin user:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

void ensureKevinUser();
