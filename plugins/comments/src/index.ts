import type { PluginExecutionContext, PluginLifecycleHooks, PluginLogger } from '@monorepo/shared';
import { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import { createCommentsRouter } from './routes/comments';

export default class CommentsPlugin implements PluginLifecycleHooks {
  private pool: Pool | null = null;
  private logger: PluginLogger | null = null;

  /**
   * Called when plugin is first installed
   * Runs all database migrations
   */
  async onInstall(context: PluginExecutionContext): Promise<void> {
    this.logger = context.logger;
    this.pool = context.db as Pool;

    this.logger.info('Installing Comments Plugin...');

    try {
      await this.runMigrations();
      this.logger.info('Comments Plugin installed successfully');
    } catch (error) {
      this.logger.error('Failed to install Comments Plugin', error as Error);
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

    this.logger.info('Activating Comments Plugin...');

    try {
      // Register API routes
      if (context.app) {
        const commentsRouter = createCommentsRouter(this.pool, this.logger);
        context.app.use('/api/comments', commentsRouter);

        this.logger.info('Routes registered successfully');
      } else {
        throw new Error('Express app not available in context');
      }

      this.logger.info('Comments Plugin activated successfully');
    } catch (error) {
      this.logger.error('Failed to activate Comments Plugin', error as Error);
      throw error;
    }
  }

  /**
   * Called when plugin is deactivated
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async onDeactivate(context: PluginExecutionContext): Promise<void> {
    this.logger = context.logger;

    this.logger.info('Deactivating Comments Plugin...');

    try {
      // Routes are automatically unregistered by plugin engine
      this.logger.info('Comments Plugin deactivated successfully');
    } catch (error) {
      this.logger.error('Failed to deactivate Comments Plugin', error as Error);
      throw error;
    }
  }

  /**
   * Called when plugin is uninstalled
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async onUninstall(context: PluginExecutionContext): Promise<void> {
    this.logger = context.logger;
    this.pool = context.db as Pool;

    this.logger.info('Uninstalling Comments Plugin...');

    // Drop schema (this will cascade and remove all tables)
    await this.pool.query('DROP SCHEMA IF EXISTS plugin_comments CASCADE');

    this.logger.info('Comments Plugin uninstalled successfully');
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
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

    // Run all migrations (simple approach for initial install)
    for (const file of migrationFiles) {
      const migrationName = file.replace('.sql', '');
      this.logger?.info(`Applying migration: ${migrationName}`);

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
