/**
 * Script to install and activate the blog plugin
 * Run with: tsx scripts/install-blog-plugin.ts
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

async function installBlogPlugin() {
  const client = await pool.connect();

  try {
    console.log('Installing blog plugin...');

    // Read all migration files
    const migrationsDir = path.join(process.cwd(), 'plugins', 'blog', 'migrations');
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

    console.log('\n✅ Blog plugin installed successfully!');
    console.log('The plugin schema and tables have been created.');
    console.log('\nNote: The blog routes will be registered when the plugin is loaded by the plugin manager.');

  } catch (error) {
    console.error('❌ Error installing blog plugin:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the installation
installBlogPlugin().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
