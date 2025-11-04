/**
 * Complete blog plugin installation (remaining migrations)
 */

import { Pool } from 'pg';
import { config } from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';

config();

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB || 'kevinalthaus',
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('Checking blog plugin installation status...');

    // Check if blog_posts table exists
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'plugin_blog'
        AND tablename = 'blog_posts'
      ) as exists;
    `);

    if (!result.rows[0].exists) {
      console.log('blog_posts table not found. Running remaining migrations...\n');

      const migrations = [
        '02-create-blog-tables.sql',
        '03-create-author-profiles.sql',
        '04-create-seo-metadata.sql'
      ];

      for (const migration of migrations) {
        console.log(`Running ${migration}...`);
        const sql = await fs.readFile(
          path.join(process.cwd(), 'plugins/blog/migrations', migration),
          'utf-8'
        );
        await client.query(sql);
        console.log(`✓ ${migration} completed`);
      }

      console.log('\n✅ Blog plugin installation complete!');
    } else {
      console.log('✓ Blog plugin already fully installed.');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
