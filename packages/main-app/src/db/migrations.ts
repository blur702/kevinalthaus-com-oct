import { query, transaction } from './index';
import { PoolClient } from 'pg';

export async function runMigrations(): Promise<void> {
  console.log('[Migrations] Running database migrations...');

  try {
    // Create migrations tracking table
    await query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Run migrations in order
    await runMigration('00-enable-pgcrypto', async (client: PoolClient) => {
      await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    });
    await runMigration('01-create-users-table', async (client: PoolClient) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          username VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL DEFAULT 'viewer',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP,
          is_active BOOLEAN DEFAULT true
        )
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      `);
    });

    await runMigration('02-create-refresh-tokens-table', async (client: PoolClient) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          revoked_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_by_ip INET,
          CONSTRAINT unique_user_token UNIQUE (user_id, token_hash)
        )
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
      `);
    });

    await runMigration('03-create-plugin-registry-table', async (client: PoolClient) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS plugin_registry (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) UNIQUE NOT NULL,
          version VARCHAR(50) NOT NULL,
          display_name VARCHAR(255) NOT NULL,
          description TEXT,
          author JSONB NOT NULL,
          manifest JSONB NOT NULL,
          status VARCHAR(50) DEFAULT 'installed',
          installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          checksum VARCHAR(64) NOT NULL,
          signature VARCHAR(128)
        )
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_plugin_registry_name ON plugin_registry(name);
        CREATE INDEX IF NOT EXISTS idx_plugin_registry_status ON plugin_registry(status);
      `);
    });

    await runMigration('04-create-system-settings-table', async (client: PoolClient) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS system_settings (
          key VARCHAR(255) PRIMARY KEY,
          value JSONB NOT NULL,
          description TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_by UUID REFERENCES users(id)
        )
      `);
    });

    await runMigration('05-create-audit-log-table', async (client: PoolClient) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id),
          action VARCHAR(255) NOT NULL,
          resource_type VARCHAR(100),
          resource_id VARCHAR(255),
          details JSONB,
          ip_address INET,
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
        CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
      `);
    });

    await runMigration('06-create-plugin-kv-store-table', async (client: PoolClient) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS plugin_kv_store (
          plugin_id UUID NOT NULL REFERENCES plugin_registry(id) ON DELETE CASCADE,
          key VARCHAR(255) NOT NULL,
          value JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (plugin_id, key)
        )
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_plugin_kv_store_plugin_id ON plugin_kv_store(plugin_id);
      `);
    });

    console.log('[Migrations] All migrations completed successfully');
  } catch (error) {
    console.error('[Migrations] Migration failed:', error);
    throw error;
  }
}

async function runMigration(
  name: string,
  migration: (client: PoolClient) => Promise<void>
): Promise<void> {
  const result = await query<{ name: string }>(
    'SELECT name FROM migrations WHERE name = $1',
    [name]
  );

  if (result.rows.length > 0) {
    console.log(`[Migrations] Skipping ${name} (already executed)`);
    return;
  }

  console.log(`[Migrations] Running ${name}...`);

  // Wrap migration execution in transaction for atomicity
  await transaction(async (client) => {
    try {
      // Execute the migration with transaction client
      await migration(client);

      // Record migration in database
      await client.query('INSERT INTO migrations (name) VALUES ($1)', [name]);

      console.log(`[Migrations] Completed ${name}`);
    } catch (error) {
      console.error(`[Migrations] Failed ${name}:`, error);
      throw error;
    }
  });
}
