/**
 * Taxonomy Plugin
 * Shared taxonomy service for categories and tags
 */

import { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import type { PluginExecutionContext, PluginLifecycleHooks, PluginLogger } from '@monorepo/shared';
import { createTaxonomyRouter } from './routes/taxonomy';

// Export types and services for use by other plugins
export * from './types';
export { TaxonomyService } from './services/TaxonomyService';

export default class TaxonomyPlugin implements PluginLifecycleHooks {
  private pool: Pool | null = null;
  private logger: PluginLogger | null = null;

  /**
   * Called when plugin is installed
   */
  async onInstall(context: PluginExecutionContext): Promise<void> {
    this.logger = context.logger;
    this.pool = context.db as Pool;

    this.logger.info('Installing Taxonomy Plugin...');

    try {
      await this.runMigrations();
      this.logger.info('Taxonomy Plugin installed successfully');
    } catch (error) {
      this.logger.error('Failed to install Taxonomy Plugin', error as Error);
      throw error;
    }
  }

  /**
   * Called when plugin is activated
   */
  async onActivate(context: PluginExecutionContext): Promise<void> {
    this.logger = context.logger;
    this.pool = context.db as Pool;

    this.logger.info('Activating Taxonomy Plugin...');

    try {
      // Register API routes
      if (context.app) {
        const router = createTaxonomyRouter(this.pool, this.logger);
        context.app.use('/api/taxonomy', router);
        this.logger.info('Routes registered successfully');
      }

      this.logger.info('Taxonomy Plugin activated successfully');
    } catch (error) {
      this.logger.error('Failed to activate Taxonomy Plugin', error as Error);
      throw error;
    }
  }

  /**
   * Called when plugin is deactivated
   */
  async onDeactivate(context: PluginExecutionContext): Promise<void> {
    this.logger = context.logger;

    this.logger.info('Deactivating Taxonomy Plugin...');
    this.logger.info('Taxonomy Plugin deactivated successfully');
  }

  /**
   * Called when plugin is uninstalled
   */
  async onUninstall(context: PluginExecutionContext): Promise<void> {
    this.logger = context.logger;
    this.pool = context.db as Pool;

    this.logger.info('Uninstalling Taxonomy Plugin...');

    // WARNING: Uncomment to drop schema and all data
    // await this.pool.query('DROP SCHEMA IF EXISTS plugin_taxonomy CASCADE');
    // this.logger.warn('Schema and all data dropped');

    this.logger.warn('Taxonomy Plugin uninstalled - data preserved');
    this.logger.info('To completely remove data, manually drop schema: DROP SCHEMA plugin_taxonomy CASCADE');
  }

  /**
   * Called when plugin is updated
   */
  async onUpdate(context: PluginExecutionContext, oldVersion: string): Promise<void> {
    this.logger = context.logger;
    this.pool = context.db as Pool;

    this.logger.info(`Updating Taxonomy Plugin from ${oldVersion}...`);

    try {
      // Run any new migrations
      await this.runMigrations();
      this.logger.info('Taxonomy Plugin updated successfully');
    } catch (error) {
      this.logger.error('Failed to update Taxonomy Plugin', error as Error);
      throw error;
    }
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    const migrationsDir = path.join(__dirname, '../migrations');

    if (!this.pool || !this.logger) {
      throw new Error('Plugin not initialized');
    }

    try {
      const files = await fs.readdir(migrationsDir);
      const sqlFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort(); // Alphabetical order ensures correct sequence

      // Get already-applied migrations
      let appliedMigrations: Set<string> = new Set();
      try {
        const result = await this.pool.query<{ migration_name: string }>(
          'SELECT migration_name FROM plugin_taxonomy.plugin_migrations'
        );
        appliedMigrations = new Set(result.rows.map(row => row.migration_name));
      } catch (error) {
        // Table doesn't exist yet (first run)
        this.logger.info('Migration tracking table not found, treating as first run');
      }

      // Filter out already-applied migrations
      const pendingMigrations = sqlFiles.filter(file => {
        const migrationName = file.replace('.sql', '');
        return !appliedMigrations.has(migrationName);
      });

      if (pendingMigrations.length === 0) {
        this.logger.info('No pending migrations');
        return;
      }

      this.logger.info(`Running ${pendingMigrations.length} pending migrations`);

      for (const file of pendingMigrations) {
        const migrationPath = path.join(migrationsDir, file);
        const sql = await fs.readFile(migrationPath, 'utf-8');
        const migrationName = file.replace('.sql', '');

        this.logger.info(`Running migration: ${file}`);

        // Use a transaction to ensure atomicity
        const client = await this.pool.connect();
        try {
          await client.query('BEGIN');

          // Run the migration SQL
          await client.query(sql);

          // Record the migration (only if tracking table exists after migration)
          try {
            await client.query(
              'INSERT INTO plugin_taxonomy.plugin_migrations (migration_name, applied_at) VALUES ($1, CURRENT_TIMESTAMP)',
              [migrationName]
            );
          } catch (insertError) {
            // If tracking table doesn't exist yet, it might be created by this migration
            // Try again after this migration completes
            this.logger.info(`Migration tracking table not available yet for ${migrationName}`);
          }

          await client.query('COMMIT');
          this.logger.info(`Migration completed: ${file}`);
        } catch (error) {
          await client.query('ROLLBACK');
          this.logger.error(`Migration failed: ${file}`, error as Error);
          throw error;
        } finally {
          client.release();
        }
      }

      // Ensure all migrations are tracked (handle case where tracking table was just created)
      for (const file of pendingMigrations) {
        const migrationName = file.replace('.sql', '');
        try {
          await this.pool.query(
            'INSERT INTO plugin_taxonomy.plugin_migrations (migration_name, applied_at) VALUES ($1, CURRENT_TIMESTAMP) ON CONFLICT (migration_name) DO NOTHING',
            [migrationName]
          );
        } catch (error) {
          this.logger.info(`Could not record migration ${migrationName} in tracking table: ${error}`);
        }
      }

      this.logger.info('All migrations completed successfully');
    } catch (error) {
      this.logger.error('Migration failed', error as Error);
      throw error;
    }
  }
}
