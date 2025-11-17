/* eslint-disable no-console */
// Seed or update a test admin user for CI E2E runs
// Uses local package dependencies (pg, bcrypt) from packages/main-app

const { Pool } = require('pg');
const bcrypt = require('bcrypt');

async function main() {
  // Build connection from CI env or fall back to defaults used in workflow services
  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.POSTGRES_PORT || '5432';
  const user = process.env.POSTGRES_USER || 'postgres';
  const password = process.env.POSTGRES_PASSWORD || 'postgres';
  const db = process.env.POSTGRES_DB || 'kevinalthaus_test';

  const connectionString = process.env.DATABASE_URL || `postgresql://${user}:${password}@${host}:${port}/${db}`;
  const pool = new Pool({ connectionString });

  const username = process.env.TEST_ADMIN_USERNAME || 'kevin';
  const email = process.env.TEST_ADMIN_EMAIL || `${username}@example.com`;
  const plainPassword = process.env.TEST_ADMIN_PASSWORD;
  const role = process.env.TEST_ADMIN_ROLE || 'admin';

  // Validate required password is set
  if (!plainPassword) {
    console.error('✗ Error: TEST_ADMIN_PASSWORD environment variable is required');
    console.error('Please set it before running this script:');
    console.error('  export TEST_ADMIN_PASSWORD="your_test_password"');
    process.exitCode = 1;
    await pool.end();
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    // Ensure unique index on username or rely on existing schema
    // Upsert by username
    const query = `
      INSERT INTO users (email, username, password_hash, role, is_active)
      VALUES ($1, $2, $3, $4, TRUE)
      ON CONFLICT (username)
      DO UPDATE SET
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        is_active = TRUE,
        updated_at = NOW()
      RETURNING id, email, username, role;
    `;
    const result = await pool.query(query, [email, username, passwordHash, role]);
    const u = result.rows[0];
    console.log(`✓ Seeded user: ${u.username} (${u.role})`);
  } catch (err) {
    console.error('✗ Failed to seed test user:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();

