/**
 * Page Builder Plugin
 *
 * Production-ready block-based page builder with drag-and-drop editor,
 * responsive grid, extensible widgets, templates, and version history.
 *
 * @module PageBuilderPlugin
 */

import { PluginExecutionContext, PluginLifecycleHooks, PluginLogger } from '@monorepo/shared/plugin/lifecycle';
import { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import { WidgetRegistryService } from './services/widget-registry.service';

/**
 * Page Builder Plugin Class
 * Implements lifecycle hooks for installation, activation, deactivation, and updates
 */
export default class PageBuilderPlugin implements PluginLifecycleHooks {
  private pool: Pool | null = null;
  private logger: PluginLogger | null = null;
  private widgetRegistry: WidgetRegistryService | null = null;

  /**
   * Install hook - runs migrations and sets up database schema
   *
   * @param context - Plugin execution context with db, app, and services
   * @throws Error if context is invalid or migrations fail
   */
  async onInstall(context: PluginExecutionContext): Promise<void> {
    // Validate context
    if (!context.db) {
      throw new Error('Database pool not available in context');
    }
    if (!context.app) {
      throw new Error('Express app not available in context');
    }

    this.pool = context.db;
    this.logger = context.logger || console;

    this.logger.info('Installing Page Builder Plugin v1.0.0...');

    try {
      const migrationsApplied = await this.runMigrations(context);
      this.logger.info(`Page Builder Plugin installed successfully. Applied ${migrationsApplied} migrations.`);
    } catch (error) {
      const err = error as Error;
      this.logger.error('Installation failed:', err);
      throw new Error(`Installation failed: ensure PostgreSQL connection and permissions. Details: ${err.message}`);
    }
  }

  /**
   * Activate hook - registers routes and initializes services
   *
   * @param context - Plugin execution context
   * @throws Error if services or app are not available
   */
  async onActivate(context: PluginExecutionContext): Promise<void> {
    // Validate context
    if (!context.db) {
      throw new Error('Database pool not available in context');
    }
    if (!context.app) {
      throw new Error('Express app not available in context');
    }

    this.pool = context.db;
    this.logger = context.logger || console;

    this.logger.info('Activating Page Builder Plugin...');

    // Discover widgets
    try {
      const pluginPath = path.join(__dirname, '..');
      this.widgetRegistry = new WidgetRegistryService(pluginPath, this.logger);
      await this.widgetRegistry.discoverWidgets();

      const widgets = this.widgetRegistry.getRegistry();
      const validWidgets = widgets.filter(w => w.isValid).length;
      const invalidWidgets = widgets.filter(w => !w.isValid).length;

      this.logger.info(`Widget discovery complete: ${validWidgets} valid, ${invalidWidgets} invalid`);
    } catch (error) {
      // Don't fail activation if widget discovery fails
      this.logger.error('Widget discovery failed, continuing with empty registry', error as Error);
      const pluginPath = path.join(__dirname, '..');
      this.widgetRegistry = new WidgetRegistryService(pluginPath, this.logger);
    }

    // Register routes
    const { createPageBuilderRouter } = await import('./routes');
    const router = createPageBuilderRouter(this.pool, this.logger, this.widgetRegistry);
    context.app.use('/api/page-builder', router);
    this.logger.info('Routes registered: /api/page-builder/*');

    this.logger.info('Page Builder Plugin activated successfully');
  }

  /**
   * Deactivate hook - cleanup and resource release
   *
   * @param context - Plugin execution context
   */
  async onDeactivate(context: PluginExecutionContext): Promise<void> {
    this.logger = context.logger || console;
    this.logger.info('Deactivating Page Builder Plugin...');

    // Cleanup: clear any cron jobs, close connections if owned
    // Note: Pool is managed by main app, so we just clear reference
    this.pool = null;
    this.widgetRegistry = null;

    this.logger.info('Page Builder Plugin deactivated cleanly');
  }

  /**
   * Uninstall hook - removes plugin data and schema
   *
   * SAFETY: Schema drop is commented out to prevent accidental data loss.
   * Uncomment only for full data purge.
   *
   * @param context - Plugin execution context
   */
  async onUninstall(context: PluginExecutionContext): Promise<void> {
    this.logger = context.logger || console;
    this.logger.info('Uninstalling Page Builder Plugin...');

    // SAFETY: Uncomment only for full data purge
    // if (context.db) {
    //   await context.db.query('DROP SCHEMA IF EXISTS plugin_page_builder CASCADE');
    //   this.logger.log('Schema dropped: plugin_page_builder');
    // }

    this.logger.info('Page Builder Plugin uninstalled (schema preserved for safety)');
  }

  /**
   * Update hook - handles plugin version updates
   *
   * @param context - Plugin execution context
   * @param oldVersion - Previous plugin version
   */
  async onUpdate(context: PluginExecutionContext, oldVersion: string): Promise<void> {
    this.pool = context.db || null;
    this.logger = context.logger || console;

    this.logger.info(`Updating Page Builder Plugin from ${oldVersion} to 1.0.0...`);

    // Run any new migrations
    if (oldVersion !== '1.0.0') {
      await this.runMigrations(context);
    }

    // Handle breaking changes if any (none for v1.0.0)

    this.logger.info('Page Builder Plugin updated successfully');
  }

  /**
   * Run database migrations with idempotency and transaction safety
   *
   * @param context - Plugin execution context
   * @returns Number of migrations applied
   * @throws Error if migrations fail
   * @private
   */
  private async runMigrations(_context: PluginExecutionContext): Promise<number> {
    if (!this.pool) {
      throw new Error('DB pool unavailable');
    }

    const migrationsPath = path.join(__dirname, '../migrations');

    try {
      const files = (await fs.readdir(migrationsPath))
        .filter(f => f.endsWith('.sql'))
        .sort();

      this.logger?.info(`Found ${files.length} migration files`);

      // Check if migrations table exists, create if not
      let applied: Set<string>;
      try {
        const result = await this.pool.query(
          'SELECT migration_name FROM plugin_page_builder.plugin_migrations ORDER BY executed_at'
        );
        applied = new Set(result.rows.map(row => row.migration_name));
      } catch (tableError: any) {
        if (tableError.code === '42P01' || tableError.code === '3F000') {
          // Table or schema doesn't exist, will be created by first migration
          applied = new Set();
        } else {
          throw tableError;
        }
      }

      let migrationsApplied = 0;

      for (const file of files) {
        const name = file.replace('.sql', '');

        if (applied.has(name)) {
          this.logger?.info(`Skipping already applied migration: ${name}`);
          continue;
        }

        this.logger?.info(`Applying migration: ${name}`);

        const client = await this.pool.connect();
        try {
          await client.query('BEGIN');

          const sql = await fs.readFile(path.join(migrationsPath, file), 'utf-8');
          await client.query(sql);

          // Record migration (if table exists)
          try {
            await client.query(
              'INSERT INTO plugin_page_builder.plugin_migrations (migration_name, executed_at) VALUES ($1, CURRENT_TIMESTAMP)',
              [name]
            );
          } catch (insertError: any) {
            // If table doesn't exist yet (first migration), that's okay
            if (insertError.code !== '42P01' && insertError.code !== '3F000') {
              throw insertError;
            }
          }

          await client.query('COMMIT');
          migrationsApplied++;
          this.logger?.info(`Successfully applied migration: ${name}`);
        } catch (mErr) {
          await client.query('ROLLBACK');
          const err = mErr as Error;
          this.logger?.error(`Migration ${name} failed: ${err.message}`, err);
          throw new Error(`Migration ${name} failed: ${err.message}`);
        } finally {
          client.release();
        }
      }

      this.logger?.info(`Migrations complete. Applied ${migrationsApplied} new migrations.`);
      return migrationsApplied;
    } catch (error) {
      const err = error as Error;
      this.logger?.error('Migration process failed:', err);
      throw err;
    }
  }
}
