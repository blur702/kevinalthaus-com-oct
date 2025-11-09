/**
 * Direct database settings verification script
 * Connects to PostgreSQL and retrieves settings data
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'myapp',
  user: process.env.POSTGRES_USER || 'myuser',
  password: process.env.POSTGRES_PASSWORD || 'mypassword',
});

async function checkDatabaseSettings() {
  let client;

  try {
    console.log('Connecting to database...');
    client = await pool.connect();
    console.log('✓ Connected to database\n');

    // Check if system_settings table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'system_settings'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('✗ system_settings table does not exist');
      return;
    }

    console.log('✓ system_settings table exists\n');

    // Fetch all settings
    const result = await client.query(`
      SELECT key, value, updated_at, updated_by
      FROM system_settings
      ORDER BY key
    `);

    console.log(`Found ${result.rows.length} settings in database:\n`);

    const settings = {};
    for (const row of result.rows) {
      console.log(`${row.key}:`);
      console.log(`  Value: ${JSON.stringify(row.value)}`);
      console.log(`  Updated: ${row.updated_at}`);
      console.log(`  Updated By: ${row.updated_by || 'N/A'}`);
      console.log('');

      settings[row.key] = {
        value: row.value,
        updated_at: row.updated_at,
        updated_by: row.updated_by
      };
    }

    // Save to file
    const screenshotsDir = path.join(__dirname, '..', 'e2e', 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const outputPath = path.join(screenshotsDir, 'database-settings.json');
    fs.writeFileSync(outputPath, JSON.stringify(settings, null, 2));
    console.log(`✓ Settings saved to: ${outputPath}`);

    // Generate markdown report
    const mdPath = path.join(screenshotsDir, 'database-settings.md');
    let markdown = '# Database Settings Report\n\n';
    markdown += `Generated: ${new Date().toISOString()}\n\n`;
    markdown += `Total settings: ${result.rows.length}\n\n`;

    markdown += '## Settings List\n\n';
    for (const row of result.rows) {
      markdown += `### ${row.key}\n\n`;
      markdown += '```json\n';
      markdown += JSON.stringify(row.value, null, 2);
      markdown += '\n```\n\n';
      markdown += `- **Updated:** ${row.updated_at}\n`;
      markdown += `- **Updated By:** ${row.updated_by || 'N/A'}\n\n`;
    }

    fs.writeFileSync(mdPath, markdown);
    console.log(`✓ Markdown report saved to: ${mdPath}`);

  } catch (error) {
    console.error('Error checking database settings:', error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

console.log('='.repeat(60));
console.log('Database Settings Verification');
console.log('='.repeat(60));
console.log('');

checkDatabaseSettings().catch(console.error);
