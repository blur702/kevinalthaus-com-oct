const { Pool } = require('pg');
const bcrypt = require('bcrypt');

async function testPasswords() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is not set');
    console.error('Please set DATABASE_URL in your .env file or environment');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: DATABASE_URL
  });

  try {
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE username = $1',
      ['kevin']
    );

    if (result.rows.length === 0) {
      console.log('User not found');
      return;
    }

    const storedHash = result.rows[0].password_hash;
    console.log('Testing passwords against stored hash...\n');

    // Test password 1: 'kevin'
    const isKevinValid = await bcrypt.compare('kevin', storedHash);
    console.log(`Password "kevin": ${isKevinValid ? 'MATCH ✓' : 'NO MATCH ✗'}`);

    // Test password 2: '(130Bpm)' (the default from seed script)
    const is130BpmValid = await bcrypt.compare('(130Bpm)', storedHash);
    console.log(`Password "(130Bpm)": ${is130BpmValid ? 'MATCH ✓' : 'NO MATCH ✗'}`);

    // Suggest solution
    console.log('\n--- SOLUTION ---');
    if (is130BpmValid || isKevinValid) {
      console.log('Credential matched - check your .env file');
      console.log('\nThe working credential has been identified.');
      console.log('Update TEST_ADMIN_PASSWORD in your .env file accordingly.');
    } else {
      console.log('Neither password matches. You may need to reset the password.');
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

testPasswords();
