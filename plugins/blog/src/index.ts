/**
 * Blog Plugin
 * Main plugin class with lifecycle hooks
 */

import type { PluginExecutionContext, PluginLifecycleHooks, PluginLogger } from '@monorepo/shared';
import { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import { createBlogRouter } from './routes/blog';

export default class BlogPlugin implements PluginLifecycleHooks {
  private pool: Pool | null = null;
  private logger: PluginLogger | null = null;

  /**
   * Called when plugin is first installed
   * Runs all database migrations
   */
  async onInstall(context: PluginExecutionContext): Promise<void> {
    this.logger = context.logger;
    this.pool = context.db as Pool;

    this.logger.info('Installing Blog Plugin...');

    try {
      await this.runMigrations(context);
      this.logger.info('Blog Plugin installed successfully');
    } catch (error) {
      this.logger.error('Failed to install Blog Plugin', error as Error);
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

    this.logger.info('Activating Blog Plugin...');

    try {
      // Register API routes
      if (context.app && context.services?.blog) {
        const blogRouter = createBlogRouter(context.services.blog, this.logger);
        context.app.use('/api/blog', blogRouter);

        this.logger.info('Routes registered successfully');
      } else {
        throw new Error('BlogService not available in context');
      }

      this.logger.info('Blog Plugin activated successfully');
    } catch (error) {
      this.logger.error('Failed to activate Blog Plugin', error as Error);
      throw error;
    }
  }

  /**
   * Called when plugin is deactivated
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async onDeactivate(context: PluginExecutionContext): Promise<void> {
    this.logger = context.logger;

    this.logger.info('Deactivating Blog Plugin...');

    try {
      this.logger.info('Blog Plugin deactivated successfully');
    } catch (error) {
      this.logger.error('Failed to deactivate Blog Plugin', error as Error);
      throw error;
    }
  }

  /**
   * Called when plugin is uninstalled
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async onUninstall(context: PluginExecutionContext): Promise<void> {
    this.logger = context.logger;

    this.logger.info('Uninstalling Blog Plugin...');

    // WARNING: Uncomment this to delete all plugin data
    // await this.pool.query('DROP SCHEMA IF EXISTS plugin_blog CASCADE');

    this.logger.info('Blog Plugin uninstalled (data preserved for safety)');
  }

  /**
   * Called when plugin is updated
   */
  async onUpdate(context: PluginExecutionContext, oldVersion: string): Promise<void> {
    this.logger = context.logger;
    this.pool = context.db as Pool;

    this.logger.info(`Updating Blog Plugin from version ${oldVersion}...`);

    try {
      await this.runMigrations(context);
      this.logger.info('Blog Plugin updated successfully');
    } catch (error) {
      this.logger.error('Failed to update Blog Plugin', error as Error);
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
        `SELECT migration_name FROM plugin_blog.plugin_migrations ORDER BY executed_at`
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

          // Record the migration
          await client.query(
            `INSERT INTO plugin_blog.plugin_migrations (migration_name, executed_at)
             VALUES ($1, CURRENT_TIMESTAMP)`,
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

      // First, ensure the migrations table exists
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS plugin_blog.plugin_migrations (
          migration_name TEXT PRIMARY KEY,
          executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      this.logger?.info('Created plugin_migrations table');

      for (const file of migrationFiles) {
        const migrationName = file.replace('.sql', '');
        this.logger?.info(`Applying migration: ${migrationName}`);

        // Wrap migration in transaction for atomicity
        const client = await this.pool.connect();
        try {
          await client.query('BEGIN');

          const sql = await fs.readFile(path.join(migrationsPath, file), 'utf-8');
          await client.query(sql);

          // Record the migration
          await client.query(
            `INSERT INTO plugin_blog.plugin_migrations (migration_name, executed_at)
             VALUES ($1, CURRENT_TIMESTAMP)`,
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
    }
  }
}
