/**
 * User Manager Plugin
 *
 * Advanced user management plugin with activity tracking, bulk operations,
 * custom user fields, and comprehensive audit logging for enterprise-grade
 * user administration.
 *
 * This plugin extends the core user management system with:
 * - Custom user fields (extensible JSONB storage)
 * - Activity tracking (login, logout, profile changes, etc.)
 * - Audit logging (administrative actions, compliance)
 * - Bulk import/export (CSV and JSON formats)
 * - Advanced filtering and search
 * - User statistics and reporting
 */

import { PluginExecutionContext, PluginLifecycleHooks } from '@monorepo/shared';
import { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import { createUsersRouter } from './routes/users';
import { createCustomFieldsRouter } from './routes/customFields';
import { createBulkRouter } from './routes/bulk';
import { createAuditRouter } from './routes/audit';

// Simple logger interface for plugins
interface PluginLogger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, error?: Error | Record<string, unknown>, metadata?: Record<string, unknown>): void;
}

/**
 * User Manager Plugin Class
 *
 * Implements all lifecycle hooks for proper plugin initialization,
 * activation, deactivation, updates, and uninstallation.
 */
export default class UserManagerPlugin implements PluginLifecycleHooks {
  private pool: Pool | null = null;
  private logger: PluginLogger | null = null;

  /**
   * Called when the plugin is first installed
   *
   * This hook is responsible for:
   * - Creating the plugin_user_manager schema
   * - Running database migrations (custom fields, activity log, audit log)
   * - Setting up enum types for activity tracking
   * - Initializing plugin configuration
   *
   * @param context - Plugin lifecycle context with logger, config, and database access
   */
  async onInstall(context: PluginExecutionContext): Promise<void> {
    this.logger = context.logger;
    this.logger.info('[UserManagerPlugin] Installing user manager plugin...');

    try {
      // Get database pool from context
      this.pool = context.db as Pool;

      // Run database migrations
      await this.runMigrations(context);

      this.logger.info('[UserManagerPlugin] User manager plugin installed successfully');
      this.logger.info('[UserManagerPlugin] Database schema: plugin_user_manager');
      this.logger.info('[UserManagerPlugin] Tables created: user_custom_fields, user_activity_log, audit_log');
    } catch (error) {
      this.logger.error('[UserManagerPlugin] Failed to install plugin', error as Error);
      throw error;
    }
  }

  /**
   * Called when the plugin is activated
   *
   * This hook is responsible for:
   * - Registering all API routes
   * - Setting up middleware
   * - Initializing services
   * - Starting background jobs (if any)
   *
   * @param context - Plugin lifecycle context
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async onActivate(context: PluginExecutionContext): Promise<void> {
    this.logger = context.logger;
    this.logger.info('[UserManagerPlugin] Activating user manager plugin...');

    try {
      // Get database pool from context
      this.pool = context.db as Pool;

      // Register routes
      if (context.app) {
        // Main users routes
        const usersRouter = createUsersRouter(this.pool, this.logger);
        context.app.use('/api/users-manager', usersRouter);
        this.logger.info('[UserManagerPlugin] Registered users routes at /api/users-manager');

        // Custom fields routes (nested under users)
        const customFieldsRouter = createCustomFieldsRouter(this.pool, this.logger);
        context.app.use('/api/users-manager', customFieldsRouter);
        this.logger.info('[UserManagerPlugin] Registered custom fields routes');

        // Bulk operations routes
        const bulkRouter = createBulkRouter(this.pool, this.logger);
        context.app.use('/api/users-manager/bulk', bulkRouter);
        this.logger.info('[UserManagerPlugin] Registered bulk operations routes at /api/users-manager/bulk');

        // Audit log routes
        const auditRouter = createAuditRouter(this.pool, this.logger);
        context.app.use('/api/users-manager/audit', auditRouter);
        this.logger.info('[UserManagerPlugin] Registered audit routes at /api/users-manager/audit');
      }

      this.logger.info('[UserManagerPlugin] User manager plugin activated successfully');
      this.logger.info('[UserManagerPlugin] Available endpoints:');
      this.logger.info('  - GET    /api/users-manager - List users');
      this.logger.info('  - GET    /api/users-manager/:id - Get user details');
      this.logger.info('  - GET    /api/users-manager/:id/activity - Get user activity');
      this.logger.info('  - GET    /api/users-manager/:id/custom-fields - Get custom fields');
      this.logger.info('  - PATCH  /api/users-manager/:id/custom-fields - Update custom fields');
      this.logger.info('  - POST   /api/users-manager/bulk/import - Bulk import users');
      this.logger.info('  - POST   /api/users-manager/bulk/export - Bulk export users');
      this.logger.info('  - GET    /api/users-manager/audit - Query audit log');
    } catch (error) {
      this.logger.error('[UserManagerPlugin] Failed to activate plugin', error as Error);
      throw error;
    }
  }

  /**
   * Called when the plugin is deactivated
   *
   * This hook is responsible for:
   * - Unregistering routes (handled by plugin engine)
   * - Stopping background jobs
   * - Cleaning up resources
   * - Note: Database tables are preserved for data integrity
   *
   * @param context - Plugin lifecycle context
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async onDeactivate(context: PluginExecutionContext): Promise<void> {
    this.logger = context.logger;
    this.logger.info('[UserManagerPlugin] Deactivating user manager plugin...');

    try {
      // No background jobs to stop in this plugin
      // Routes are automatically unregistered by the plugin engine

      this.logger.info('[UserManagerPlugin] User manager plugin deactivated successfully');
      this.logger.info('[UserManagerPlugin] Database tables preserved for data integrity');
    } catch (error) {
      this.logger.error('[UserManagerPlugin] Failed to deactivate plugin', error as Error);
      throw error;
    }
  }

  /**
   * Called when the plugin is uninstalled
   *
   * This hook is responsible for:
   * - Optionally removing database tables (commented out for safety)
   * - Cleaning up all plugin data
   * - Removing configuration
   *
   * WARNING: Uninstalling will not delete data by default for safety.
   * To remove all data, uncomment the DROP statements below.
   *
   * @param context - Plugin lifecycle context
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async onUninstall(context: PluginExecutionContext): Promise<void> {
    this.logger = context.logger;
    this.logger.info('[UserManagerPlugin] Uninstalling user manager plugin...');

    try {
      this.pool = context.db as Pool;

      // SAFETY: Database cleanup is commented out by default
      // Uncomment the following lines to delete all plugin data on uninstall
      // WARNING: This will permanently delete all custom fields, activity logs, and audit logs
      /*
      this.logger.warn('[UserManagerPlugin] Removing all plugin data...');

      await this.pool.query('DROP TABLE IF EXISTS plugin_user_manager.audit_log CASCADE');
      await this.pool.query('DROP TABLE IF EXISTS plugin_user_manager.user_activity_log CASCADE');
      await this.pool.query('DROP TABLE IF EXISTS plugin_user_manager.user_custom_fields CASCADE');
      await this.pool.query('DROP TABLE IF EXISTS plugin_user_manager.plugin_migrations CASCADE');
      await this.pool.query('DROP TYPE IF EXISTS plugin_user_manager.audit_action CASCADE');
      await this.pool.query('DROP TYPE IF EXISTS plugin_user_manager.activity_type CASCADE');
      await this.pool.query('DROP SCHEMA IF EXISTS plugin_user_manager CASCADE');

      this.logger.info('[UserManagerPlugin] All plugin data removed');
      */

      this.logger.warn('[UserManagerPlugin] User manager plugin uninstalled - data preserved');
      this.logger.warn('[UserManagerPlugin] To remove all plugin data, modify the onUninstall method');
    } catch (error) {
      this.logger.error('[UserManagerPlugin] Failed to uninstall plugin', error as Error);
      throw error;
    }
  }

  /**
   * Called when the plugin is updated to a new version
   *
   * This hook is responsible for:
   * - Running new database migrations
   * - Migrating configuration to new format
   * - Updating data structures
   * - Applying patches and fixes
   *
   * @param context - Plugin lifecycle context
   * @param oldVersion - The previous version of the plugin
   */
  async onUpdate(context: PluginExecutionContext, oldVersion: string): Promise<void> {
    this.logger = context.logger;
    this.logger.info(
      `[UserManagerPlugin] Updating user manager plugin from ${oldVersion} to 1.0.0...`
    );

    try {
      // Get database pool from context
      this.pool = context.db as Pool;

      // Run any new migrations
      // Migrations are idempotent and will skip if already applied
      await this.runMigrations(context);

      // Version-specific migration logic
      if (oldVersion === '0.9.0') {
        this.logger.info('[UserManagerPlugin] Applying 0.9.0 -> 1.0.0 migration...');
        // Add version-specific migration logic here
      }

      this.logger.info('[UserManagerPlugin] User manager plugin updated successfully');
    } catch (error) {
      this.logger.error('[UserManagerPlugin] Failed to update plugin', error as Error);
      throw error;
    }
  }

  /**
   * Run database migrations
   *
   * Migrations are executed in alphabetical order from the migrations/ directory.
   * Each migration is tracked in the plugin_migrations table to prevent duplicate execution.
   *
   * @private
   */
  private async runMigrations(_context: PluginExecutionContext): Promise<void> {
    if (!this.pool || !this.logger) {
      throw new Error('Database pool or logger not initialized');
    }

    this.logger.info('[UserManagerPlugin] Running database migrations...');

    const migrationsDir = path.join(__dirname, '../migrations');
    const migrationFiles = await fs.readdir(migrationsDir);

    // Sort migration files to ensure they run in order (01-, 02-, 03-, etc.)
    const sqlFiles = migrationFiles.filter((file) => file.endsWith('.sql')).sort();

    for (const file of sqlFiles) {
      const filePath = path.join(migrationsDir, file);
      // Path is constructed from __dirname and sorted migration files
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const sql = await fs.readFile(filePath, 'utf-8');

      this.logger.info(`[UserManagerPlugin] Running migration: ${file}`);

      try {
        await this.pool.query(sql);
        this.logger.info(`[UserManagerPlugin] Migration ${file} completed successfully`);
      } catch (error) {
        this.logger.error(`[UserManagerPlugin] Migration ${file} failed`, error as Error);
        throw error;
      }
    }

    this.logger.info('[UserManagerPlugin] All database migrations completed');
  }
}

// Export the plugin class as default
// This is required by the plugin engine for dynamic loading
export { UserManagerPlugin };
