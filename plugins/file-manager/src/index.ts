/**
 * File Manager Plugin
 * Main plugin class with lifecycle hooks
 */

import type { PluginExecutionContext, PluginLifecycleHooks, PluginLogger } from '@monorepo/shared';
import { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import { createFoldersRouter, createFilesFolderRouter } from './routes/folders';
import { createBatchRouter } from './routes/batch';
import { StorageWrapper } from './services/storageWrapper';

export default class FileManagerPlugin implements PluginLifecycleHooks {
  private pool: Pool | null = null;
  private logger: PluginLogger | null = null;
  private storageService: StorageWrapper | null = null;

  /**
   * Called when plugin is first installed
   * Runs all database migrations
   */
  async onInstall(context: PluginExecutionContext): Promise<void> {
    this.logger = context.logger;
    this.pool = context.db as Pool;

    this.logger.info('Installing File Manager Plugin...');

    try {
      await this.runMigrations(context);
      this.logger.info('File Manager Plugin installed successfully');
    } catch (error) {
      this.logger.error('Failed to install File Manager Plugin', error as Error);
      throw error;
    }
  }

  /**
   * Called when plugin is activated
   * Registers routes
   */
  async onActivate(context: PluginExecutionContext): Promise<void> {
    this.logger = context.logger;
    this.pool = context.db as Pool;

    this.logger.info('Activating File Manager Plugin...');

    try {
      // Initialize StorageWrapper for file operations
      this.storageService = new StorageWrapper(this.pool, this.logger);
      this.logger.info('StorageWrapper initialized');

      // Register API routes
      if (context.app) {
        const foldersRouter = createFoldersRouter(this.pool, this.logger);
        const filesFolderRouter = createFilesFolderRouter(this.pool, this.logger);
        const batchRouter = createBatchRouter(this.pool, this.logger, this.storageService);

        context.app.use('/api/file-manager/folders', foldersRouter);
        context.app.use('/api/file-manager/files', filesFolderRouter);
        context.app.use('/api/file-manager/batch', batchRouter);

        this.logger.info('Routes registered successfully');
      } else {
        throw new Error('Express app not available in context');
      }

      this.logger.info('File Manager Plugin activated successfully');
    } catch (error) {
      this.logger.error('Failed to activate File Manager Plugin', error as Error);
      throw error;
    }
  }

  /**
   * Called when plugin is deactivated
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async onDeactivate(context: PluginExecutionContext): Promise<void> {
    this.logger = context.logger;

    this.logger.info('Deactivating File Manager Plugin...');

    try {
      // Release reference to StorageService (managed by main app)
      this.storageService = null;

      // Routes are automatically unregistered by plugin engine
      this.logger.info('File Manager Plugin deactivated successfully');
    } catch (error) {
      this.logger.error('Failed to deactivate File Manager Plugin', error as Error);
      throw error;
    }
  }

  /**
   * Called when plugin is uninstalled
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async onUninstall(context: PluginExecutionContext): Promise<void> {
    this.logger = context.logger;

    this.logger.info('Uninstalling File Manager Plugin...');

    // WARNING: Uncomment this to delete all plugin data
    // await this.pool.query('DROP SCHEMA IF EXISTS plugin_file_manager CASCADE');

    this.logger.info('File Manager Plugin uninstalled (data preserved for safety)');
    this.logger.warn('To completely remove plugin data, manually run: DROP SCHEMA IF EXISTS plugin_file_manager CASCADE');
  }

  /**
   * Called when plugin is updated
   */
  async onUpdate(context: PluginExecutionContext, oldVersion: string): Promise<void> {
    this.logger = context.logger;
    this.pool = context.db as Pool;

    this.logger.info(`Updating File Manager Plugin from version ${oldVersion}...`);

    try {
      await this.runMigrations(context);
      this.logger.info('File Manager Plugin updated successfully');
    } catch (error) {
      this.logger.error('Failed to update File Manager Plugin', error as Error);
      throw error;
    }
  }

  /**
   * Run database migrations
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async runMigrations(context: PluginExecutionContext): Promise<void> {
    // Guard: ensure pool is initialized
    if (!this.pool) {
      const error = new Error('Database pool not initialized');
      this.logger?.error('Cannot run migrations: pool not initialized', error);
      throw error;
    }

    const migrationsPath = path.join(__dirname, '../migrations');

    this.logger?.info(`Reading migrations from: ${migrationsPath}`);

    // Read all migration files
    const files = await fs.readdir(migrationsPath);
    const migrationFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort();

    this.logger?.info(`Found ${migrationFiles.length} migration files`);

    // Get applied migrations
    try {
      const result = await this.pool.query(
        `SELECT migration_name FROM plugin_file_manager.plugin_migrations ORDER BY executed_at`
      );
      const appliedMigrations = new Set(result.rows.map(r => r.migration_name));

      // Apply pending migrations
      for (const file of migrationFiles) {
        const migrationName = file.replace('.sql', '');

        if (appliedMigrations.has(migrationName)) {
          this.logger?.info(`Skipping already applied migration: ${migrationName}`);
          continue;
        }

        this.logger?.info(`Applying migration: ${migrationName}`);

        // Wrap migration in transaction for atomicity
        const client = await this.pool.connect();
        try {
          await client.query('BEGIN');

          const sql = await fs.readFile(path.join(migrationsPath, file), 'utf-8');
          await client.query(sql);

          // Record the migration (if not already recorded by the migration itself)
          await client.query(
            `INSERT INTO plugin_file_manager.plugin_migrations (migration_name, executed_at)
             VALUES ($1, CURRENT_TIMESTAMP)
             ON CONFLICT (migration_name) DO NOTHING`,
            [migrationName]
          );

          await client.query('COMMIT');
          this.logger?.info(`Successfully applied migration: ${migrationName}`);
        } catch (migrationError) {
          await client.query('ROLLBACK');
          this.logger?.error(`Failed to apply migration ${migrationName}, rolled back`, migrationError as Error);
          throw migrationError;
        } finally {
          client.release();
        }
      }
    } catch (error) {
      // Check if error is specifically "table not found" (PostgreSQL error code 42P01)
      const isTableNotFound = (error as { code?: string }).code === '42P01';

      if (!isTableNotFound) {
        // For other errors (connection issues, permissions, etc.), log and rethrow
        this.logger?.error('Error checking migrations table', error as Error);
        throw error;
      }

      // If migrations table doesn't exist yet, run all migrations
      this.logger?.info('Migrations table not found, running all migrations');

      for (const file of migrationFiles) {
        const migrationName = file.replace('.sql', '');
        this.logger?.info(`Applying migration: ${migrationName}`);

        // Wrap migration in transaction for atomicity
        const client = await this.pool.connect();
        try {
          await client.query('BEGIN');

          const sql = await fs.readFile(path.join(migrationsPath, file), 'utf-8');
          await client.query(sql);

          await client.query('COMMIT');
          this.logger?.info(`Successfully applied migration: ${migrationName}`);
        } catch (migrationError) {
          await client.query('ROLLBACK');
          this.logger?.error(`Failed to apply migration ${migrationName}, rolled back`, migrationError as Error);
          throw migrationError;
        } finally {
          client.release();
        }
      }
    }
  }
}
