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
    // Get password from environment variable
    const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
    if (!adminPassword) {
      // eslint-disable-next-line no-console
      console.error('✗ Error: ADMIN_INITIAL_PASSWORD environment variable is not set');
      // eslint-disable-next-line no-console
      console.error('Please set it before running this script:');
      // eslint-disable-next-line no-console
      console.error('  export ADMIN_INITIAL_PASSWORD="your_secure_password"');
      process.exit(1);
    }

    // Hash the password (inside try/catch to ensure proper cleanup)
    const hashedPassword = await hashPassword(adminPassword);

    // Check if admin user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      ['kevin']
    );

    if (existingUser.rows.length > 0) {
      // eslint-disable-next-line no-console
      console.log('✓ Admin user already exists');
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
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('✗ Error seeding admin user:', error);
    process.exit(1);
  } finally {
    // Always close the pool regardless of success or failure
    await pool.end();
  }
}

void seedAdminUser();
