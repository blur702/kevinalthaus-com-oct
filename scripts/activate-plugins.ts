/**
 * Activate content-manager and blog plugins
 */

import { Pool } from 'pg';
import { config } from 'dotenv';

config();

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB || 'kevinalthaus',
});

async function activatePlugin(pluginName: string) {
  const client = await pool.connect();
  try {
    // Check if plugin record exists
    const checkResult = await client.query(
      'SELECT id, status FROM plugins WHERE name = $1',
      [pluginName]
    );

    if (checkResult.rows.length === 0) {
      console.log(`Creating plugin record for ${pluginName}...`);
      await client.query(
        `INSERT INTO plugins (name, version, status, installed_at, activated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [pluginName, '1.0.0', 'active']
      );
      console.log(`✓ ${pluginName} plugin activated`);
    } else {
      const currentStatus = checkResult.rows[0].status;
      if (currentStatus === 'active') {
        console.log(`✓ ${pluginName} plugin already active`);
      } else {
        console.log(`Activating ${pluginName} plugin...`);
        await client.query(
          'UPDATE plugins SET status = $1, activated_at = NOW() WHERE name = $2',
          ['active', pluginName]
        );
        console.log(`✓ ${pluginName} plugin activated`);
      }
    }
  } finally {
    client.release();
  }
}

async function main() {
  try {
    console.log('Activating plugins...\n');

    await activatePlugin('content-manager');
    await activatePlugin('blog');

    console.log('\n✅ All plugins activated!');
    console.log('\nNext steps:');
    console.log('1. Restart the services to load the plugin routes');
    console.log('2. Run Playwright tests to verify functionality');
  } catch (error) {
    console.error('❌ Error activating plugins:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
