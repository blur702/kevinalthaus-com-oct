import { Pool } from 'pg';
import { hashPassword } from '@monorepo/shared';

interface UserRow {
  id: string;
  email: string;
  username: string;
  role: string;
}

async function seedE2ETestUser(): Promise<void> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:changeme_secure_password@localhost:55432/kevinalthaus',
  });

  try {
    // Hash the password
    const hashedPassword = await hashPassword('password123');

    // Check if test user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      ['kevin@example.com']
    );

    if (existingUser.rows.length > 0) {
      // eslint-disable-next-line no-console
      console.log('✓ E2E test user already exists');
      await pool.end();
      return;
    }

    // Insert E2E test user
    const result = await pool.query<UserRow>(
      `INSERT INTO users (id, email, username, password_hash, role, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
       RETURNING id, email, username, role`,
      ['kevin@example.com', 'kevin_test', hashedPassword, 'admin']
    );

    const testUser = result.rows[0];
    // eslint-disable-next-line no-console
    console.log('✓ E2E test user created successfully:');
    // eslint-disable-next-line no-console
    console.log('  Email:', testUser.email);
    // eslint-disable-next-line no-console
    console.log('  Username:', testUser.username);
    // eslint-disable-next-line no-console
    console.log('  Role:', testUser.role);
    // eslint-disable-next-line no-console
    console.log('  ID:', testUser.id);

    await pool.end();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('✗ Error seeding E2E test user:', error);
    await pool.end();
    process.exit(1);
  }
}

void seedE2ETestUser();
