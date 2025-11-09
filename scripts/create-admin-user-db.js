/**
 * Create admin user directly in database
 * This bypasses password policy for test/development
 */

const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Database configuration from environment variables
const pool = new Pool({
  host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || process.env.DB_PORT || '55432', 10),
  database: process.env.POSTGRES_DB || process.env.DB_NAME || 'kevinalthaus',
  user: process.env.POSTGRES_USER || process.env.DB_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_SSL === 'true' || process.env.POSTGRES_SSL === 'true' || false
});

async function createAdminUser() {
  try {
    console.log('[Create Admin User] Connecting to database...');

    // Get password from environment variable (REQUIRED - no fallback)
    const password = process.env.ADMIN_PASSWORD || process.env.DEFAULT_ADMIN_PASSWORD;

    if (!password) {
      console.error('[Create Admin User] ✗ ERROR: ADMIN_PASSWORD or DEFAULT_ADMIN_PASSWORD environment variable is required');
      console.error('[Create Admin User] Set one of these environment variables before running this script');
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      ['kevin', 'kevin@kevinalthaus.com']
    );

    if (existingUser.rows.length > 0) {
      console.log('[Create Admin User] ⚠ User already exists');
      console.log('User ID:', existingUser.rows[0].id, 'Username:', existingUser.rows[0].username);
      await pool.end();
      return;
    }

    // Create admin user
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, email, role`,
      ['kevin', 'kevin@kevinalthaus.com', passwordHash, 'admin', true]
    );

    console.log('[Create Admin User] ✓ Admin user created successfully');
    if (result.rows && result.rows[0]) {
      console.log('User ID:', result.rows[0].id, 'Username:', result.rows[0].username, 'Role:', result.rows[0].role);
    }

    await pool.end();
  } catch (error) {
    console.error('[Create Admin User] ✗ Error:', error.message);

    // Attempt to close pool connection with error handling
    if (pool) {
      try {
        await pool.end();
      } catch (poolError) {
        console.error('[Create Admin User] ✗ Error closing pool:', poolError.message);
      }
    }

    process.exit(1);
  }
}

createAdminUser();
