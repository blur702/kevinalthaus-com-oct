import { Pool } from 'pg';
import { hashPassword } from '@monorepo/shared';

interface AdminUserRow {
  id: string;
  email: string;
  username: string;
  role: string;
}

async function seedAdminUser(): Promise<void> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:changeme_secure_password@localhost:55432/kevinalthaus',
  });

  try {
    // Hash the password
    const hashedPassword = await hashPassword('(130Bpm)');

    // Check if admin user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      ['kevin']
    );

    if (existingUser.rows.length > 0) {
      // eslint-disable-next-line no-console
      console.log('✓ Admin user already exists');
      await pool.end();
      return;
    }

    // Insert admin user (permanent, cannot be deleted)
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

    await pool.end();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('✗ Error seeding admin user:', error);
    await pool.end();
    process.exit(1);
  }
}

void seedAdminUser();
