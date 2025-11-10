const { Pool } = require('pg');

async function checkUser() {
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
      `SELECT id, username, email, role, is_active, created_at
       FROM users WHERE username = $1`,
      ['kevin']
    );

    if (result.rows.length === 0) {
      console.log('User "kevin" not found in database');
      console.log('\nSearching for any admin users...');

      const admins = await pool.query(
        `SELECT id, username, email, role, is_active, created_at
         FROM users WHERE role = 'admin'`
      );

      if (admins.rows.length === 0) {
        console.log('No admin users found');
      } else {
        console.log('Found admin users:');
        admins.rows.forEach(user => {
          console.log(`  - ${user.username} (${user.email})`);
        });
      }
    } else {
      console.log('User "kevin" found:');
      console.log(JSON.stringify(result.rows[0], null, 2));
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkUser();
