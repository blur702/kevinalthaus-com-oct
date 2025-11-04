/**
 * Script to install and activate both content-manager and blog plugins
 * Run with: tsx scripts/install-plugins.ts
 */

import { Pool } from 'pg';
import { config } from 'dotenv';
import path from 'path';
import { promises as fs } from 'fs';

// Load environment variables
config();

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB || 'kevinalthaus',
});

async function installPlugin(pluginName: string) {
  const client = await pool.connect();

  try {
    console.log(`\n=== Installing ${pluginName} plugin ===`);

    // Read all migration files
    const migrationsDir = path.join(process.cwd(), 'plugins', pluginName, 'migrations');
    const files = await fs.readdir(migrationsDir);
    const migrationFiles = files.filter(f => f.endsWith('.sql')).sort();

    console.log(`Found ${migrationFiles.length} migration files`);

    // Run each migration
    for (const file of migrationFiles) {
      console.log(`Running migration: ${file}`);
      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf-8');
      await client.query(sql);
      console.log(`✓ ${file} completed`);
    }

    console.log(`✅ ${pluginName} plugin installed successfully!`);

  } catch (error) {
    console.error(`❌ Error installing ${pluginName} plugin:`, error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    // Install content-manager first (dependency for blog plugin)
    await installPlugin('content-manager');

    // Then install blog plugin
    await installPlugin('blog');

    console.log('\n✅ All plugins installed successfully!');
    console.log('\nNext steps:');
    console.log('1. Activate the plugins via the admin UI or plugin manager');
    console.log('2. Restart services to load the plugin routes');
    console.log('3. Run Playwright tests to verify functionality');

  } catch (error) {
    console.error('\n❌ Fatal error during plugin installation:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the installation
main();
