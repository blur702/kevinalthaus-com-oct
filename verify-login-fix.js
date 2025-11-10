const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function verifyLoginFix() {
  console.log('=== Verifying Login Fix ===\n');

  // 1. Check environment variables
  console.log('1. Environment Variables:');
  console.log(`   TEST_ADMIN_USERNAME: ${process.env.TEST_ADMIN_USERNAME}`);
  console.log(`   TEST_ADMIN_PASSWORD: [REDACTED]`);
  console.log();

  // 2. Check database user
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('2. Database User:');
    const userResult = await pool.query(
      'SELECT id, username, email, role, is_active, password_hash FROM users WHERE username = $1',
      [process.env.TEST_ADMIN_USERNAME]
    );

    if (userResult.rows.length === 0) {
      console.log('   ERROR: User not found in database!');
      return;
    }

    const user = userResult.rows[0];
    console.log(`   Username: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Active: ${user.is_active}`);
    console.log();

    // 3. Verify password
    console.log('3. Password Verification:');
    const passwordMatches = await bcrypt.compare(
      process.env.TEST_ADMIN_PASSWORD,
      user.password_hash
    );

    if (passwordMatches) {
      console.log('   ✓ SUCCESS: Password matches!');
      console.log();
      console.log('=== All Checks Passed ===');
      console.log('The E2E test should now work with these credentials:');
      console.log(`   Username: ${process.env.TEST_ADMIN_USERNAME}`);
      console.log(`   Password: [REDACTED]`);
    } else {
      console.log('   ✗ ERROR: Password does not match!');
      console.log();
      console.log('Please run: node test-kevin-password.js');
      console.log('to find the correct password.');
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

verifyLoginFix();
