import { Pool } from 'pg';
import { hashPassword } from '@monorepo/shared';

async function resetPassword(): Promise<void> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:changeme_secure_password@localhost:55432/kevinalthaus',
  });

  try {
    // Hash the password
    const hashedPassword = await hashPassword('(130Bpm)');

    // Update kevin user password
    const result = await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE username = $2 RETURNING id, email, username',
      [hashedPassword, 'kevin']
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('✓ Password reset successfully for user:');
      console.log('  Username:', user.username);
      console.log('  Email:', user.email);
      console.log('  ID:', user.id);
      console.log('  New password: (130Bpm)');
    } else {
      console.log('✗ User "kevin" not found');
    }

    await pool.end();
  } catch (error) {
    console.error('✗ Error resetting password:', error);
    await pool.end();
    process.exit(1);
  }
}

void resetPassword();
