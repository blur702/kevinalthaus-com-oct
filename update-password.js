// Update kevin user password
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '55432'),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB || 'kevinalthaus',
});

const newPasswordHash = '$2b$10$6HAC4OM8WMyiqM2MvaqdN.VvWSIqtui7nCyJc8buqj20vm1mikWSy';

async function updatePassword() {
  try {
    const result = await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE username = $2 RETURNING id, username, email',
      [newPasswordHash, 'kevin']
    );

    if (result.rows.length > 0) {
      console.log('Password updated successfully for user:', result.rows[0]);
    } else {
      console.log('User not found');
    }
  } catch (error) {
    console.error('Error updating password:', error);
  } finally {
    await pool.end();
  }
}

updatePassword();
