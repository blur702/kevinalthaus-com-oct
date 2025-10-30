import { Pool } from 'pg';
import { hashPassword } from '@monorepo/shared';

async function seedAdminUser() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:changeme_secure_password@localhost:55432/kevinalthaus',
  });

  try {
    // Hash the password
    const hashedPassword = await hashPassword('Admin123!');

    // Check if admin user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      ['admin@kevinalthaus.com']
    );

    if (existingUser.rows.length > 0) {
      console.log('✓ Admin user already exists');
      await pool.end();
      return;
    }

    // Insert admin user
    const result = await pool.query(
      `INSERT INTO users (id, email, username, password, role, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
       RETURNING id, email, username, role`,
      ['admin@kevinalthaus.com', 'admin', hashedPassword, 'admin']
    );

    console.log('✓ Admin user created successfully:');
    console.log('  Email:', result.rows[0].email);
    console.log('  Username:', result.rows[0].username);
    console.log('  Role:', result.rows[0].role);
    console.log('  ID:', result.rows[0].id);

    await pool.end();
  } catch (error) {
    console.error('✗ Error seeding admin user:', error);
    await pool.end();
    process.exit(1);
  }
}

seedAdminUser();
