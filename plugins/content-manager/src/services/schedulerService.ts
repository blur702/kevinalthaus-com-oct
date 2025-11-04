/**
 * Scheduler Service
 * Handles scheduled publishing of content
 */

import { Pool } from 'pg';
import * as cron from 'node-cron';
import type { PluginLogger } from '@monorepo/shared';

export class SchedulerService {
  private pool: Pool;
  private logger: PluginLogger;
  private task: cron.ScheduledTask | null = null;
  private isRunning = false;

  constructor(pool: Pool, logger: PluginLogger) {
    this.pool = pool;
    this.logger = logger;
  }

  /**
   * Start the scheduled publishing cron job
   * Runs every minute to check for content that should be published
   */
  async start(): Promise<void> {
    if (this.task) {
      this.logger.warn('Scheduler already running');
      return;
    }

    // Run every minute with overlap protection
    this.task = cron.schedule('* * * * *', async () => {
      if (this.isRunning) {
        this.logger.warn('Scheduled publish already running, skipping this iteration');
        return;
      }

      this.isRunning = true;
      try {
        await this.publishScheduledContent();
      } finally {
        this.isRunning = false;
      }
    });

    this.logger.info('Scheduled publishing service started (checking every minute)');
  }

  /**
   * Stop the scheduled publishing cron job
   */
  async stop(): Promise<void> {
    if (this.task) {
      this.task.stop();
      this.task = null;
      this.isRunning = false; // Reset flag when stopping
      this.logger.info('Scheduled publishing service stopped');
    }
  }

  /**
   * Check for and publish content that is scheduled to be published
   */
  private async publishScheduledContent(): Promise<void> {
    try {
      const now = new Date();

      // Find all content with status 'scheduled' and publish_at <= now
      const result = await this.pool.query<{ id: string; title: string }>(
        `
        UPDATE plugin_content_manager.content
        SET
          status = 'published',
          published_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE
          status = 'scheduled'
          AND publish_at <= $1
          AND deleted_at IS NULL
        RETURNING id, title
        `,
        [now]
      );

      if (result.rows.length > 0) {
        this.logger.info(`Published ${result.rows.length} scheduled content items:`, {
          count: result.rows.length,
          items: result.rows.map(r => ({ id: r.id, title: r.title }))
        });

        // Create audit log entries in database for each published item
        for (const row of result.rows) {
          try {
            await this.pool.query(
              `INSERT INTO plugin_content_manager.content_versions
               (content_id, version_number, title, slug, body_html, excerpt, meta_description, meta_keywords, status, change_summary, created_by)
               SELECT $1, COALESCE((SELECT MAX(version_number) FROM plugin_content_manager.content_versions WHERE content_id = $1), 0) + 1, title, slug, body_html, excerpt, meta_description, meta_keywords, status, $2, created_by
               FROM plugin_content_manager.content
               WHERE id = $1`,
              [row.id, `Automatically published via scheduler at ${new Date().toISOString()}`]
            );
            this.logger.info(`Content published automatically: ${row.title} (${row.id})`);
          } catch (auditError) {
            this.logger.error(`Failed to create audit log for ${row.id}`, auditError as Error);
          }
        }
      }
    } catch (error) {
      this.logger.error('Error publishing scheduled content', error as Error);
    }
  }

  /**
   * Manually trigger scheduled content publication (for testing)
   */
  async triggerNow(): Promise<number> {
    await this.publishScheduledContent();
    const result = await this.pool.query<{ count: string }>(
      `
      SELECT COUNT(*) as count
      FROM plugin_content_manager.content
      WHERE status = 'scheduled' AND deleted_at IS NULL
      `
    );
    return parseInt(result.rows[0]?.count || '0', 10);
  }
}
