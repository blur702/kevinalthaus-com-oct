const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '55432', 10),
  database: process.env.POSTGRES_DB || 'kevinalthaus',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres'
});

async function updatePassword() {
  try {
    // Get password from environment variable
    const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
    if (!adminPassword) {
      console.error('✗ Error: ADMIN_INITIAL_PASSWORD environment variable is not set');
      console.error('Please set it before running this script:');
      console.error('  export ADMIN_INITIAL_PASSWORD="your_secure_password"');
      await pool.end();
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2 OR username = $3 RETURNING id, email, username',
      [passwordHash, 'kevin@kevinalthaus.com', 'kevin']
    );

    if (result.rows.length > 0) {
      console.log('✓ Password updated for user:', result.rows[0].email);
    } else {
      console.log('✗ User not found - creating new user...');
      // Create the user if it doesn't exist
      const createResult = await pool.query(
        'INSERT INTO users (username, email, password_hash, role, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, username',
        ['kevin', 'kevin@kevinalthaus.com', passwordHash, 'admin', true]
      );
      console.log('✓ User created:', createResult.rows[0].email);
    }
    await pool.end();
  } catch (error) {
    console.error('✗ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

updatePassword();
