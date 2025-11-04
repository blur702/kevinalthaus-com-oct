/**
 * Content Manager Plugin
 * Main plugin class with lifecycle hooks
 */

import type { PluginExecutionContext, PluginLifecycleHooks, PluginLogger } from '@monorepo/shared';
import { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import { createContentRouter } from './routes/content';
import { createMediaRouter } from './routes/media';
import { createTaxonomyRouter } from './routes/taxonomy';
import { createFileTypesRouter } from './routes/fileTypes';
import { SchedulerService } from './services/schedulerService';

export default class ContentManagerPlugin implements PluginLifecycleHooks {
  private pool: Pool | null = null;
  private logger: PluginLogger | null = null;
  private schedulerService: SchedulerService | null = null;

  /**
   * Called when plugin is first installed
   * Runs all database migrations
   */
  async onInstall(context: PluginExecutionContext): Promise<void> {
    this.logger = context.logger;
    this.pool = context.db as Pool;

    this.logger.info('Installing Content Manager Plugin...');

    try {
      await this.runMigrations(context);
      this.logger.info('Content Manager Plugin installed successfully');
    } catch (error) {
      this.logger.error('Failed to install Content Manager Plugin', error as Error);
      throw error;
    }
  }

  /**
   * Called when plugin is activated
   * Registers routes and starts scheduled publishing service
   */
  async onActivate(context: PluginExecutionContext): Promise<void> {
    this.logger = context.logger;
    this.pool = context.db as Pool;

    this.logger.info('Activating Content Manager Plugin...');

    try {
      // Register API routes
      if (context.app) {
        // Content management routes
        const contentRouter = createContentRouter(this.pool, this.logger);
        context.app.use('/api/content', contentRouter);

        // Media management routes
        const mediaRouter = createMediaRouter(this.pool, this.logger);
        context.app.use('/api/content/media', mediaRouter);

        // Taxonomy routes (categories and tags)
        const taxonomyRouter = createTaxonomyRouter(this.pool, this.logger);
        context.app.use('/api/content', taxonomyRouter);

        // File types configuration routes
        const fileTypesRouter = createFileTypesRouter(this.pool, this.logger);
        context.app.use('/api/content/file-types', fileTypesRouter);

        this.logger.info('Routes registered successfully');
      }

      // Start scheduled publishing service
      this.schedulerService = new SchedulerService(this.pool, this.logger);
      await this.schedulerService.start();

      this.logger.info('Content Manager Plugin activated successfully');
    } catch (error) {
      this.logger.error('Failed to activate Content Manager Plugin', error as Error);
      throw error;
    }
  }

  /**
   * Called when plugin is deactivated
   * Stops scheduled services and cleans up resources
   */
  async onDeactivate(context: PluginExecutionContext): Promise<void> {
    this.logger = context.logger;

    this.logger.info('Deactivating Content Manager Plugin...');

    try {
      // Stop scheduled publishing service
      if (this.schedulerService) {
        await this.schedulerService.stop();
        this.schedulerService = null;
      }

      // Routes are automatically unregistered by plugin engine
      this.logger.info('Content Manager Plugin deactivated successfully');
    } catch (error) {
      this.logger.error('Failed to deactivate Content Manager Plugin', error as Error);
      throw error;
    }
  }

  /**
   * Called when plugin is uninstalled
   * WARNING: Database cleanup is commented out by default for safety
   * Uncomment to drop schema and all data on uninstall
   */
  async onUninstall(context: PluginExecutionContext): Promise<void> {
    this.logger = context.logger;
    this.pool = context.db as Pool;

    this.logger.warn('Uninstalling Content Manager Plugin...');

    try {
      // Stop scheduler if running
      if (this.schedulerService) {
        await this.schedulerService.stop();
        this.schedulerService = null;
      }

      // WARNING: Uncomment to drop schema and all data
      // await this.pool.query('DROP SCHEMA IF EXISTS plugin_content_manager CASCADE');
      // this.logger.warn('Schema and all data dropped');

      this.logger.warn('Content Manager Plugin uninstalled - data preserved');
      this.logger.info('To completely remove data, manually drop schema: DROP SCHEMA plugin_content_manager CASCADE');
    } catch (error) {
      this.logger.error('Failed to uninstall Content Manager Plugin', error as Error);
      throw error;
    }
  }

  /**
   * Called when plugin is updated
   * Runs new migrations and handles version-specific updates
   */
  async onUpdate(context: PluginExecutionContext, oldVersion: string): Promise<void> {
    this.logger = context.logger;
    this.pool = context.db as Pool;

    this.logger.info(`Updating Content Manager Plugin from ${oldVersion} to 1.0.0...`);

    try {
      // Run any new migrations
      await this.runMigrations(context);

      // Version-specific migration logic
      if (oldVersion === '0.9.0') {
        this.logger.info('Applying 0.9.0 -> 1.0.0 migration...');
        // Add version-specific updates here
      }

      this.logger.info('Content Manager Plugin updated successfully');
    } catch (error) {
      this.logger.error('Failed to update Content Manager Plugin', error as Error);
      throw error;
    }
  }

  /**
   * Runs all SQL migration files from migrations directory
   */
  private async runMigrations(_context: PluginExecutionContext): Promise<void> {
    if (!this.pool || !this.logger) {
      throw new Error('Pool or logger not initialized');
    }

    const migrationsDir = path.join(__dirname, '../migrations');
    this.logger.info(`Running migrations from ${migrationsDir}...`);

    try {
      // Get already-applied migrations
      let appliedMigrations: Set<string> = new Set();
      try {
        const result = await this.pool.query<{ migration_name: string }>(
          'SELECT migration_name FROM plugin_content_manager.plugin_migrations'
        );
        appliedMigrations = new Set(result.rows.map(row => row.migration_name));
        this.logger.info(`Found ${appliedMigrations.size} already-applied migrations`);
      } catch (error) {
        // Table doesn't exist yet (first run), treat as no applied migrations
        this.logger.info('Migration tracking table not found, treating as first run');
      }

      const migrationFiles = await fs.readdir(migrationsDir);
      const sqlFiles = migrationFiles
        .filter(f => f.endsWith('.sql'))
        .sort();

      this.logger.info(`Found ${sqlFiles.length} migration files`);

      // Filter out already-applied migrations
      const pendingMigrations = sqlFiles.filter(file => {
        const migrationName = file.replace('.sql', '');
        return !appliedMigrations.has(migrationName);
      });

      if (pendingMigrations.length === 0) {
        this.logger.info('No pending migrations to run');
        return;
      }

      this.logger.info(`Running ${pendingMigrations.length} pending migrations`);

      for (const file of pendingMigrations) {
        const filePath = path.join(migrationsDir, file);
        this.logger.info(`Executing migration: ${file}`);

        const sql = await fs.readFile(filePath, 'utf-8');
        await this.pool.query(sql);

        this.logger.info(`Migration ${file} completed successfully`);
      }

      this.logger.info('All migrations completed successfully');
    } catch (error) {
      this.logger.error('Migration failed', error as Error);
      throw error;
    }
  }
}

export { ContentManagerPlugin };
