import { PluginExecutionContext, PluginLifecycleHooks } from '@monorepo/shared';
import { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import { createAuthRouter } from './routes/auth';
import { authenticateToken, requireRole, optionalAuth } from './middleware/auth';

/**
 * Authentication Plugin
 *
 * Provides JWT-based authentication with user registration, login, token refresh,
 * logout, and role-based access control functionality.
 *
 * This plugin implements the complete authentication lifecycle including:
 * - User registration with password hashing
 * - Login with JWT access and refresh tokens
 * - Token refresh mechanism
 * - Secure logout with token revocation
 * - Role-based access control (RBAC)
 */
export default class AuthPlugin implements PluginLifecycleHooks {
  private pool: Pool | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private routePath: string | null = null;

  /**
   * Called when the plugin is first installed
   *
   * This hook is responsible for:
   * - Setting up database schema (users, refresh_tokens tables)
   * - Creating default admin user if needed
   * - Initializing plugin configuration
   *
   * @param context - Plugin lifecycle context with logger, config, and database access
   */
  async onInstall(context: PluginExecutionContext): Promise<void> {
    context.logger.info('[AuthPlugin] Installing authentication plugin...');

    try {
      // Get database pool from context
      this.pool = context.db as Pool;

      // Run database migrations
      await this.runMigrations(context);

      context.logger.info('[AuthPlugin] Authentication plugin installed successfully');
    } catch (error) {
      context.logger.error('[AuthPlugin] Failed to install plugin:', error as Error);
      throw error;
    }
  }

  /**
   * Called when the plugin is activated
   *
   * This hook is responsible for:
   * - Registering authentication routes
   * - Initializing JWT token management
   * - Setting up authentication middleware
   *
   * @param context - Plugin lifecycle context
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async onActivate(context: PluginExecutionContext): Promise<void> {
    context.logger.info('[AuthPlugin] Activating authentication plugin...');

    try {
      // Get database pool from context
      this.pool = context.db as Pool;

      // Register authentication routes
      if (context.app) {
        const authRouter = createAuthRouter(this.pool);
        this.routePath = '/api/auth';
        context.app.use(this.routePath, authRouter);
        context.logger.info(`[AuthPlugin] Registered authentication routes at ${this.routePath}`);
      }

      // Start token cleanup service (runs every hour)
      this.startTokenCleanup(context);

      context.logger.info('[AuthPlugin] Authentication plugin activated successfully');
    } catch (error) {
      context.logger.error('[AuthPlugin] Failed to activate plugin:', error as Error);
      throw error;
    }
  }

  /**
   * Called when the plugin is deactivated
   *
   * This hook is responsible for:
   * - Unregistering authentication routes (requires app restart for full cleanup)
   * - Stopping background services
   * - Cleaning up active sessions
   *
   * @param context - Plugin lifecycle context
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async onDeactivate(context: PluginExecutionContext): Promise<void> {
    context.logger.info('[AuthPlugin] Deactivating authentication plugin...');

    try {
      // Stop token cleanup service
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
        context.logger.info('[AuthPlugin] Stopped token cleanup service');
      }

      // Note: Express does not provide a built-in way to unregister routes
      // The routes will remain registered until the application is restarted
      // This is a known limitation of Express middleware architecture
      if (this.routePath && context.app) {
        context.logger.warn(
          `[AuthPlugin] Routes at ${this.routePath} will remain registered until app restart. ` +
          'This is a limitation of Express.js - recommend restarting the application for full cleanup.'
        );
        this.routePath = null;
      }

      context.logger.info('[AuthPlugin] Authentication plugin deactivated successfully');
    } catch (error) {
      context.logger.error('[AuthPlugin] Failed to deactivate plugin:', error as Error);
      throw error;
    }
  }

  /**
   * Called when the plugin is uninstalled
   *
   * This hook is responsible for:
   * - Removing database schema (with user confirmation)
   * - Cleaning up all plugin data
   * - Revoking all active tokens
   *
   * @param context - Plugin lifecycle context
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async onUninstall(context: PluginExecutionContext): Promise<void> {
    context.logger.info('[AuthPlugin] Uninstalling authentication plugin...');

    try {
      // Stop cleanup service if running
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }

      // Optionally drop tables (commented out for safety)
      // Uncomment if you want to remove all data on uninstall
      /*
      if (this.pool) {
        await this.pool.query('DROP TABLE IF EXISTS refresh_tokens CASCADE');
        await this.pool.query('DROP TABLE IF EXISTS users CASCADE');
        context.logger.info('[AuthPlugin] Removed database tables');
      }
      */

      context.logger.warn('[AuthPlugin] Authentication plugin uninstalled - user data preserved');
    } catch (error) {
      context.logger.error('[AuthPlugin] Failed to uninstall plugin:', error as Error);
      throw error;
    }
  }

  /**
   * Called when the plugin is updated to a new version
   *
   * This hook is responsible for:
   * - Running database migrations for schema changes
   * - Migrating configuration to new format
   * - Updating authentication logic
   *
   * @param context - Plugin lifecycle context
   * @param oldVersion - The previous version of the plugin
   */
  async onUpdate(context: PluginExecutionContext, oldVersion: string): Promise<void> {
    context.logger.info(`[AuthPlugin] Updating authentication plugin from ${oldVersion} to 1.0.0...`);

    try {
      // Get database pool from context
      this.pool = context.db as Pool;

      // Run any new migrations
      await this.runMigrations(context);

      context.logger.info('[AuthPlugin] Authentication plugin updated successfully');
    } catch (error) {
      context.logger.error('[AuthPlugin] Failed to update plugin:', error as Error);
      throw error;
    }
  }

  /**
   * Run database migrations with tracking
   */
  private async runMigrations(context: PluginExecutionContext): Promise<void> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    context.logger.info('[AuthPlugin] Running database migrations...');

    // Ensure plugin_migrations table exists
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS plugin_auth.plugin_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const migrationsDir = path.join(__dirname, '../migrations');
    const migrationFiles = await fs.readdir(migrationsDir);

    // Sort migration files to ensure they run in order
    const sqlFiles = migrationFiles
      .filter(file => file.endsWith('.sql'))
      .sort();

    // Get list of already applied migrations
    const appliedMigrations = await this.pool.query<{ migration_name: string }>(
      'SELECT migration_name FROM plugin_auth.plugin_migrations'
    );
    const appliedSet = new Set(appliedMigrations.rows.map(r => r.migration_name.replace('.sql', '')));

    // Filter to only pending migrations
    const pendingMigrations = sqlFiles.filter(file => !appliedSet.has(file.replace('.sql', '')));

    if (pendingMigrations.length === 0) {
      context.logger.info('[AuthPlugin] No pending migrations');
      return;
    }

    for (const file of pendingMigrations) {
      const filePath = path.join(migrationsDir, file);
      const migrationName = file.replace('.sql', '');
      // Path is constructed from __dirname and sorted migration files
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const sql = await fs.readFile(filePath, 'utf-8');

      context.logger.info(`[AuthPlugin] Running migration: ${file}`);

      // Use a transaction to ensure atomicity
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);

        // Record the migration
        await client.query(
          'INSERT INTO plugin_auth.plugin_migrations (migration_name) VALUES ($1) ON CONFLICT (migration_name) DO NOTHING',
          [migrationName]
        );

        await client.query('COMMIT');
        context.logger.info(`[AuthPlugin] Migration completed: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        context.logger.error(`[AuthPlugin] Migration failed: ${file}`, error as Error);
        throw error;
      } finally {
        client.release();
      }
    }

    context.logger.info('[AuthPlugin] Database migrations completed');
  }

  /**
   * Start token cleanup service to remove expired tokens
   */
  private startTokenCleanup(context: PluginExecutionContext): void {
    if (!this.pool) {
      context.logger.warn('[AuthPlugin] Cannot start token cleanup - no database pool');
      return;
    }

    const pool = this.pool;

    // Run cleanup every hour
    this.cleanupInterval = setInterval(() => {
      void (async () => {
        try {
          const result = await pool.query(
            'DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP'
          );
          const deletedCount = result.rowCount || 0;
          if (deletedCount > 0) {
            context.logger.info(`[AuthPlugin] Cleaned up ${deletedCount} expired refresh tokens`);
          }
        } catch (error) {
          context.logger.error('[AuthPlugin] Token cleanup failed:', error as Error);
        }
      })();
    }, 60 * 60 * 1000); // 1 hour

    context.logger.info('[AuthPlugin] Started token cleanup service');
  }
}

// Export middleware for use by other plugins/applications
export { authenticateToken, requireRole, optionalAuth };
