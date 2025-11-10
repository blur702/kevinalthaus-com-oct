const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkAdminUsers() {
  try {
    const result = await pool.query(
      "SELECT id, username, email, role FROM users WHERE role='admin' ORDER BY created_at LIMIT 5"
    );

    console.log('\nAdmin users in database:');
    console.log('========================');

    if (result.rows.length === 0) {
      console.log('No admin users found!');
    } else {
      result.rows.forEach(user => {
        console.log(`Username: ${user.username}, Email: ${user.email}, Role: ${user.role}`);
      });
    }

    await pool.end();
  } catch (error) {
    console.error('Error checking admin users:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkAdminUsers();
