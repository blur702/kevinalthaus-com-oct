import { query, transaction, pool } from './index';
import { PoolClient } from 'pg';
import { createHash } from 'crypto';

// Advisory lock ID derived from application namespace to prevent collisions
// If multiple apps share the same database, they should use different lock IDs
// Lock ID is 32-bit signed integer (-2^31 to 2^31-1), derived from hash of namespace
const MIGRATION_LOCK_NAMESPACE = process.env.MIGRATION_LOCK_NAMESPACE || 'kevinalthaus-com-oct';

function deriveLockId(namespace: string): number {
  // Create SHA256 hash of namespace and take first 4 bytes
  const hash = createHash('sha256').update(namespace).digest();
  // Convert first 4 bytes to signed 32-bit integer
  // Use bitwise operations to ensure result fits in int32 range
  const lockId = hash.readInt32BE(0);
  return lockId;
}

// Allow explicit override of lock ID via environment variable
let MIGRATION_LOCK_ID: number;
let lockIdMethod: string;

if (process.env.MIGRATION_LOCK_ID) {
  const explicitLockId = parseInt(process.env.MIGRATION_LOCK_ID, 10);
  if (!Number.isFinite(explicitLockId) || explicitLockId < -2147483648 || explicitLockId > 2147483647) {
    throw new Error(
      `MIGRATION_LOCK_ID must be a valid 32-bit signed integer (${-2147483648} to ${2147483647}), got: ${process.env.MIGRATION_LOCK_ID}`
    );
  }
  MIGRATION_LOCK_ID = explicitLockId;
  lockIdMethod = 'explicit (MIGRATION_LOCK_ID)';
} else {
  MIGRATION_LOCK_ID = deriveLockId(MIGRATION_LOCK_NAMESPACE);
  lockIdMethod = `derived from namespace: ${MIGRATION_LOCK_NAMESPACE}`;
}

// Log the lock ID for reference (helpful for debugging lock conflicts)
// eslint-disable-next-line no-console
console.log(`[Migrations] Using advisory lock ID ${MIGRATION_LOCK_ID} (${lockIdMethod})`);

export async function runMigrations(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('[Migrations] Running database migrations...');

  // Get a dedicated client to hold the advisory lock for the entire migration duration
  const lockClient = await pool.connect();

  try {
    // Acquire advisory lock with retry logic and timeout to prevent indefinite hangs
    // Parse timeout from env (default 30 seconds)
    const lockTimeoutMs = parseInt(process.env.MIGRATION_LOCK_TIMEOUT_MS || '30000', 10);
    const baseDelayMs = 1000;

    // eslint-disable-next-line no-console
    console.log(`[Migrations] Acquiring migration lock (timeout: ${lockTimeoutMs}ms)...`);

    const startTime = Date.now();
    let acquired = false;
    let attempt = 0;

    while (!acquired && Date.now() - startTime < lockTimeoutMs) {
      attempt++;
      const result = await lockClient.query<{ acquired: boolean }>('SELECT pg_try_advisory_lock($1) AS acquired', [MIGRATION_LOCK_ID]);
      acquired = result.rows[0]?.acquired === true;

      if (!acquired) {
        if (Date.now() - startTime >= lockTimeoutMs) {
          break;
        }
        // Exponential backoff with jitter
        const delayMs = Math.min(baseDelayMs * Math.pow(2, attempt - 1), 5000);
        const jitter = Math.random() * delayMs * 0.1;
        await new Promise(resolve => setTimeout(resolve, delayMs + jitter));
      }
    }

    if (!acquired) {
      const elapsed = Date.now() - startTime;
      console.error(`[Migrations] Failed to acquire migration lock after ${elapsed}ms. Another migration may be running.`);
      throw new Error(`Migration lock acquisition timeout after ${elapsed}ms. Please ensure no other migrations are running.`);
    }

    // eslint-disable-next-line no-console
    console.log('[Migrations] Migration lock acquired');

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
          updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL
        )
      `);
    });

    await runMigration('05-create-audit-log-table', async (client: PoolClient) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
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

    await runMigration('07-add-refresh-token-context', async (client: PoolClient) => {
      // Add user_agent and device_label columns to refresh_tokens for context binding
      await client.query(`
        ALTER TABLE refresh_tokens
        ADD COLUMN IF NOT EXISTS user_agent TEXT,
        ADD COLUMN IF NOT EXISTS device_label VARCHAR(255);
      `);

      // Create index on user_agent for efficient lookups during refresh token validation
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_agent ON refresh_tokens(user_agent);
      `);
    });

    await runMigration('08-add-case-insensitive-username-index', async (client: PoolClient) => {
      // Pre-flight check: Detect case-insensitive duplicate usernames before migration
      const duplicateCheck = await client.query(`
        SELECT LOWER(username) as username_lower, array_agg(username) as conflicting_usernames, COUNT(*) as count
        FROM users
        GROUP BY LOWER(username)
        HAVING COUNT(*) > 1
        ORDER BY count DESC, LOWER(username);
      `);

      if (duplicateCheck.rows.length > 0) {
        const conflicts = duplicateCheck.rows.map((row: { username_lower: string; conflicting_usernames: string[]; count: number }) =>
          `  - "${row.username_lower}" (${row.count} variants: ${row.conflicting_usernames.join(', ')})`
        ).join('\n');

        throw new Error(
          `Migration 08 cannot proceed: Found ${duplicateCheck.rows.length} case-insensitive duplicate username(s):\n${conflicts}\n\n` +
          `Next steps:\n` +
          `1. Choose a canonical lowercase username for each conflict group\n` +
          `2. Either merge accounts (transfer data, delete duplicates) or rename usernames to make them unique\n` +
          `3. Re-run migrations after resolving conflicts\n\n` +
          `Example SQL to rename a duplicate:\n` +
          `  UPDATE users SET username = 'uniquename' WHERE username = 'DuplicateName';`
        );
      }

      // Drop the original case-sensitive UNIQUE constraint to avoid conflicts
      // Default autogenerated name for UNIQUE(username) is usually users_username_key
      await client.query(`
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;
      `);

      // Create functional unique index on LOWER(username) for case-insensitive uniqueness
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));
      `);

      // Logins should use LOWER(username) = LOWER($1) with this index for performance
    });

    await runMigration('09-create-password-reset-tokens-table', async (client: PoolClient) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          used_at TIMESTAMP,
          created_by_ip INET,
          CONSTRAINT unique_token_hash UNIQUE (token_hash)
        )
      `);

      // Create indexes for efficient lookups
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
        CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
      `);
    });

    await runMigration('10-create-password-history-table', async (client: PoolClient) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS password_history (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create index for efficient retrieval of recent passwords
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_password_history_user_id_created_at ON password_history(user_id, created_at DESC);
      `);
    });

    await runMigration('11-create-page-views-table', async (client: PoolClient) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS page_views (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          url VARCHAR(2048) NOT NULL,
          path VARCHAR(2048) NOT NULL,
          user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
          ip_address INET NULL,
          user_agent TEXT NULL,
          referrer VARCHAR(2048) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for efficient querying
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(path);
        CREATE INDEX IF NOT EXISTS idx_page_views_user_id ON page_views(user_id) WHERE user_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_page_views_url ON page_views(url);
      `);
    });

    await runMigration('12-create-api-keys-table', async (client: PoolClient) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          key_prefix VARCHAR(16) NOT NULL,
          key_hash VARCHAR(255) NOT NULL,
          scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
          last_used_at TIMESTAMP NULL,
          expires_at TIMESTAMP NULL,
          revoked_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for efficient querying
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
        CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
        CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at) WHERE expires_at IS NOT NULL;
      `);
    });

    await runMigration('13-create-vocabularies-table', async (client: PoolClient) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS vocabularies (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          machine_name VARCHAR(255) UNIQUE NOT NULL,
          description TEXT,
          hierarchy_depth INTEGER NOT NULL DEFAULT 0,
          allow_multiple BOOLEAN NOT NULL DEFAULT true,
          required BOOLEAN NOT NULL DEFAULT false,
          weight INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for efficient querying
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_vocabularies_machine_name ON vocabularies(machine_name);
        CREATE INDEX IF NOT EXISTS idx_vocabularies_weight ON vocabularies(weight);
      `);
    });

    await runMigration('14-create-terms-table', async (client: PoolClient) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS terms (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          vocabulary_id UUID NOT NULL REFERENCES vocabularies(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(255) NOT NULL,
          description TEXT,
          parent_id UUID NULL REFERENCES terms(id) ON DELETE CASCADE,
          weight INTEGER NOT NULL DEFAULT 0,
          meta_data JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_vocabulary_slug UNIQUE (vocabulary_id, slug)
        )
      `);

      // Create indexes for efficient querying
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_terms_vocabulary_id ON terms(vocabulary_id);
        CREATE INDEX IF NOT EXISTS idx_terms_slug ON terms(slug);
        CREATE INDEX IF NOT EXISTS idx_terms_parent_id ON terms(parent_id) WHERE parent_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_terms_weight ON terms(weight);
      `);
    });

    await runMigration('15-create-entity-terms-table', async (client: PoolClient) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS entity_terms (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          entity_type VARCHAR(100) NOT NULL,
          entity_id VARCHAR(255) NOT NULL,
          term_id UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_entity_term UNIQUE (entity_type, entity_id, term_id)
        )
      `);

      // Create indexes for efficient querying
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_entity_terms_entity ON entity_terms(entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS idx_entity_terms_term_id ON entity_terms(term_id);
      `);
    });

    await runMigration('16-create-file-shares-table', async (client: PoolClient) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS file_shares (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
          share_token VARCHAR(64) UNIQUE NOT NULL,
          created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TIMESTAMP,
          max_downloads INTEGER,
          download_count INTEGER DEFAULT 0 CHECK (download_count >= 0),
          password_hash VARCHAR(255),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_accessed_at TIMESTAMP
        )
      `);

      // Create indexes for efficient querying
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_file_shares_file_id ON file_shares(file_id);
        CREATE INDEX IF NOT EXISTS idx_file_shares_share_token ON file_shares(share_token);
        CREATE INDEX IF NOT EXISTS idx_file_shares_created_by ON file_shares(created_by);
        CREATE INDEX IF NOT EXISTS idx_file_shares_expires_at ON file_shares(expires_at) WHERE expires_at IS NOT NULL;
      `);
    });

    await runMigration('17-create-file-versions-table', async (client: PoolClient) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS file_versions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
          version_number INTEGER NOT NULL,
          storage_path VARCHAR(500) NOT NULL,
          file_size BIGINT NOT NULL,
          mime_type VARCHAR(100) NOT NULL,
          checksum VARCHAR(64),
          created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_file_version UNIQUE (file_id, version_number)
        )
      `);

      // Create indexes for efficient querying
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_file_versions_file_id ON file_versions(file_id);
        CREATE INDEX IF NOT EXISTS idx_file_versions_created_at ON file_versions(created_at);
      `);
    });

    // eslint-disable-next-line no-console
    console.log('[Migrations] All migrations completed successfully');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Migrations] Migration failed:', error);
    throw error;
  } finally {
    // Release advisory lock and return client to pool
    try {
      await lockClient.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
      // eslint-disable-next-line no-console
      console.log('[Migrations] Migration lock released');
    } catch (unlockError) {
      // eslint-disable-next-line no-console
      console.error('[Migrations] Failed to release migration lock:', unlockError);
      // Don't throw here, as the lock will be auto-released when connection closes
    } finally {
      // Always release the client back to the pool
      lockClient.release();
      // eslint-disable-next-line no-console
      console.log('[Migrations] Lock client released');
    }
  }
}

async function runMigration(
  name: string,
  migration: (client: PoolClient) => Promise<void>
): Promise<void> {
  const result = await query<{ name: string }>('SELECT name FROM migrations WHERE name = $1', [
    name,
  ]);

  if (result.rows.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`[Migrations] Skipping ${name} (already executed)`);
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`[Migrations] Running ${name}...`);

  // Wrap migration execution in transaction for atomicity
  await transaction(async (client) => {
    try {
      // Execute the migration with transaction client
      await migration(client);

      // Record migration in database
      await client.query('INSERT INTO migrations (name) VALUES ($1)', [name]);

      // eslint-disable-next-line no-console
      console.log(`[Migrations] Completed ${name}`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[Migrations] Failed ${name}:`, error);
      throw error;
    }
  });
}
