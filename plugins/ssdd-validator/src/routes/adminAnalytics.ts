/**
 * Admin analytics handler
 * Returns aggregated statistics and metrics for admin dashboard
 */

import type { Request, Response } from 'express';
import { Pool } from 'pg';
import { PluginExecutionContext } from '@monorepo/shared';

interface StateCount {
  state: string;
  count: number;
}

interface DistrictCount {
  state: string;
  districtNumber: string;
  name: string;
  count: number;
}

interface StatusCount {
  validationStatus: string;
  count: number;
}

interface DailyActivity {
  date: string;
  count: number;
}

interface UserCount {
  id: string;
  email: string;
  username: string;
  count: number;
}

/**
 * Get analytics handler (admin only)
 */
export function getAnalyticsHandler(context: PluginExecutionContext) {
  return async (_req: Request, res: Response): Promise<void> => {
    const { logger, db } = context;
    const pool = db as Pool;

    try {
      logger.info('Getting admin analytics');

      // Execute all queries in parallel
      const [
        totalResult,
        byStateResult,
        byDistrictResult,
        byStatusResult,
        recentActivityResult,
        topUsersResult,
      ] = await Promise.all([
        // Total validations count
        pool.query<{ total: string }>(`
          SELECT COUNT(*) as total
          FROM plugin_ssdd_validator.addresses
        `),

        // Validations by state
        pool.query<{ state: string; count: string }>(`
          SELECT state, COUNT(*) as count
          FROM plugin_ssdd_validator.addresses
          WHERE state IS NOT NULL
          GROUP BY state
          ORDER BY count DESC
          LIMIT 10
        `),

        // Validations by district
        pool.query<{ state: string; district_number: string; name: string; count: string }>(`
          SELECT d.state, d.district_number, d.name, COUNT(a.id) as count
          FROM plugin_ssdd_validator.addresses a
          JOIN plugin_ssdd_validator.districts d ON a.district_id = d.id
          GROUP BY d.id, d.state, d.district_number, d.name
          ORDER BY count DESC
          LIMIT 10
        `),

        // Validations by status
        pool.query<{ validation_status: string; count: string }>(`
          SELECT validation_status, COUNT(*) as count
          FROM plugin_ssdd_validator.addresses
          GROUP BY validation_status
        `),

        // Recent activity (last 30 days)
        pool.query<{ date: string; count: string }>(`
          SELECT DATE(created_at) as date, COUNT(*) as count
          FROM plugin_ssdd_validator.addresses
          WHERE created_at >= NOW() - INTERVAL '30 days'
          GROUP BY DATE(created_at)
          ORDER BY date DESC
        `),

        // Top users by validation count
        pool.query<{ id: string; email: string; username: string; count: string }>(`
          SELECT u.id, u.email, u.username, COUNT(a.id) as count
          FROM plugin_ssdd_validator.addresses a
          JOIN public.users u ON a.created_by = u.id
          GROUP BY u.id, u.email, u.username
          ORDER BY count DESC
          LIMIT 10
        `),
      ]);

      // Parse and format results
      const totalValidations = parseInt(totalResult.rows[0]?.total || '0', 10);

      const byState: StateCount[] = byStateResult.rows.map(row => ({
        state: row.state,
        count: parseInt(row.count, 10),
      }));

      const byDistrict: DistrictCount[] = byDistrictResult.rows.map(row => ({
        state: row.state,
        districtNumber: row.district_number,
        name: row.name,
        count: parseInt(row.count, 10),
      }));

      const byStatus: StatusCount[] = byStatusResult.rows.map(row => ({
        validationStatus: row.validation_status,
        count: parseInt(row.count, 10),
      }));

      const recentActivity: DailyActivity[] = recentActivityResult.rows.map(row => ({
        date: row.date,
        count: parseInt(row.count, 10),
      }));

      const topUsers: UserCount[] = topUsersResult.rows.map(row => ({
        id: row.id,
        email: row.email,
        username: row.username,
        count: parseInt(row.count, 10),
      }));

      logger.info('Analytics retrieved successfully', {
        totalValidations,
        statesCount: byState.length,
        districtsCount: byDistrict.length,
        statusesCount: byStatus.length,
        daysCount: recentActivity.length,
        topUsersCount: topUsers.length,
      });

      res.status(200).json({
        success: true,
        analytics: {
          totalValidations,
          byState,
          byDistrict,
          byStatus,
          recentActivity,
          topUsers,
        },
      });
    } catch (error) {
      logger.error('Error getting admin analytics', error as Error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while getting analytics',
      });
    }
  };
}
