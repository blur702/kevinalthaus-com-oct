import { Router, Response } from 'express';
import { query } from '../db';
import { createLogger } from '@monorepo/shared';
import { Role } from '@monorepo/shared';
import { AuthenticatedRequest, authMiddleware } from '../auth';
import { requireRole } from '../auth/rbac-middleware';

const router = Router();
const logger = createLogger();

// Apply authentication and admin role requirement to all routes
router.use(authMiddleware);
router.use(requireRole(Role.ADMIN));

/**
 * GET /api/analytics/page-views
 * Query page views with filtering, pagination, and aggregation
 */
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.get('/page-views', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Parse query parameters
    const startDate = req.query.startDate ? String(req.query.startDate) : null;
    const endDate = req.query.endDate ? String(req.query.endDate) : null;
    const pathFilter = req.query.path ? String(req.query.path) : null;
    const userIdFilter = req.query.userId ? String(req.query.userId) : null;
    const limitParam = req.query.limit ? Number(req.query.limit) : 100;
    const offsetParam = req.query.offset ? Number(req.query.offset) : 0;
    const groupBy = req.query.groupBy ? String(req.query.groupBy) : null;

    // Validate parameters
    const limit = Math.min(Math.max(1, limitParam), 1000); // Clamp between 1-1000
    const offset = Math.max(0, offsetParam);

    // Validate groupBy
    const validGroupBy = ['hour', 'day', 'week', 'month'];
    if (groupBy && !validGroupBy.includes(groupBy)) {
      res.status(400).json({
        success: false,
        error: `Invalid groupBy value. Must be one of: ${validGroupBy.join(', ')}`,
      });
      return;
    }

    // Build query parameters array
    const queryParams: (string | number)[] = [];
    let paramIndex = 1;

    // Build WHERE clause
    const whereClauses: string[] = ['1=1'];

    if (startDate) {
      whereClauses.push(`created_at >= $${paramIndex}`);
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClauses.push(`created_at <= $${paramIndex}`);
      queryParams.push(endDate);
      paramIndex++;
    }

    if (pathFilter) {
      whereClauses.push(`path LIKE $${paramIndex}`);
      queryParams.push(pathFilter);
      paramIndex++;
    }

    if (userIdFilter) {
      whereClauses.push(`user_id = $${paramIndex}`);
      queryParams.push(userIdFilter);
      paramIndex++;
    }

    const whereClause = whereClauses.join(' AND ');

    // Build query based on groupBy
    if (groupBy) {
      // Aggregated query
      const sql = `
        SELECT
          DATE_TRUNC('${groupBy}', created_at) as period,
          COUNT(*) as count,
          COUNT(DISTINCT user_id) as unique_users
        FROM page_views
        WHERE ${whereClause}
        GROUP BY period
        ORDER BY period DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      queryParams.push(limit, offset);

      const result = await query<{ period: Date; count: string; unique_users: string }>(sql, queryParams);

      // Get total count for pagination
      const countSql = `
        SELECT COUNT(DISTINCT DATE_TRUNC('${groupBy}', created_at)) as total
        FROM page_views
        WHERE ${whereClause}
      `;
      const countResult = await query<{ total: string }>(countSql, queryParams.slice(0, -2));
      const total = parseInt(countResult.rows[0]?.total || '0', 10);

      res.json({
        success: true,
        data: result.rows.map(row => ({
          period: row.period,
          count: parseInt(row.count, 10),
          unique_users: parseInt(row.unique_users, 10),
        })),
        pagination: {
          limit,
          offset,
          total,
        },
        filters: {
          startDate,
          endDate,
          path: pathFilter,
          userId: userIdFilter,
          groupBy,
        },
      });
    } else {
      // Individual records query
      const sql = `
        SELECT id, url, path, user_id, ip_address, user_agent, referrer, created_at
        FROM page_views
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      queryParams.push(limit, offset);

      const result = await query<{
        id: string;
        url: string;
        path: string;
        user_id: string | null;
        ip_address: string | null;
        user_agent: string | null;
        referrer: string | null;
        created_at: Date;
      }>(sql, queryParams);

      // Get total count for pagination
      const countSql = `SELECT COUNT(*) as total FROM page_views WHERE ${whereClause}`;
      const countResult = await query<{ total: string }>(countSql, queryParams.slice(0, -2));
      const total = parseInt(countResult.rows[0]?.total || '0', 10);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          limit,
          offset,
          total,
        },
        filters: {
          startDate,
          endDate,
          path: pathFilter,
          userId: userIdFilter,
        },
      });
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to query page views', err);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve page views',
    });
  }
});

/**
 * GET /api/analytics/page-views/stats
 * Get summary statistics for page views
 */
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.get('/page-views/stats', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Execute multiple queries for statistics
    const [totalViews, uniqueVisitors, viewsToday, viewsThisWeek, viewsThisMonth, topPages] = await Promise.all([
      // Total page views
      query<{ count: string }>('SELECT COUNT(*) as count FROM page_views'),

      // Unique visitors (by user_id or ip_address)
      query<{ count: string }>(
        'SELECT COUNT(DISTINCT COALESCE(user_id::text, ip_address::text)) as count FROM page_views'
      ),

      // Views today
      query<{ count: string }>(
        'SELECT COUNT(*) as count FROM page_views WHERE created_at >= CURRENT_DATE'
      ),

      // Views this week
      query<{ count: string }>(
        "SELECT COUNT(*) as count FROM page_views WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE)"
      ),

      // Views this month
      query<{ count: string }>(
        "SELECT COUNT(*) as count FROM page_views WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)"
      ),

      // Top 10 pages
      query<{ path: string; views: string }>(
        'SELECT path, COUNT(*) as views FROM page_views GROUP BY path ORDER BY views DESC LIMIT 10'
      ),
    ]);

    res.json({
      success: true,
      stats: {
        total_views: parseInt(totalViews.rows[0]?.count || '0', 10),
        unique_visitors: parseInt(uniqueVisitors.rows[0]?.count || '0', 10),
        views_today: parseInt(viewsToday.rows[0]?.count || '0', 10),
        views_this_week: parseInt(viewsThisWeek.rows[0]?.count || '0', 10),
        views_this_month: parseInt(viewsThisMonth.rows[0]?.count || '0', 10),
        top_pages: topPages.rows.map(row => ({
          path: row.path,
          views: parseInt(row.views, 10),
        })),
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to retrieve page view stats', err);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics',
    });
  }
});

/**
 * GET /api/analytics/page-views/top-pages
 * Get top pages by view count with date filtering
 */
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.get('/page-views/top-pages', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Parse query parameters
    const limitParam = req.query.limit ? Number(req.query.limit) : 10;
    const startDate = req.query.startDate ? String(req.query.startDate) : null;
    const endDate = req.query.endDate ? String(req.query.endDate) : null;

    // Validate limit
    const limit = Math.min(Math.max(1, limitParam), 100); // Clamp between 1-100

    // Build query parameters
    const queryParams: (string | number)[] = [];
    let paramIndex = 1;

    // Build WHERE clause
    const whereClauses: string[] = ['1=1'];

    if (startDate) {
      whereClauses.push(`created_at >= $${paramIndex}`);
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClauses.push(`created_at <= $${paramIndex}`);
      queryParams.push(endDate);
      paramIndex++;
    }

    const whereClause = whereClauses.join(' AND ');

    // Query top pages
    const sql = `
      SELECT
        path,
        COUNT(*) as views,
        COUNT(DISTINCT COALESCE(user_id::text, ip_address::text)) as unique_visitors
      FROM page_views
      WHERE ${whereClause}
      GROUP BY path
      ORDER BY views DESC
      LIMIT $${paramIndex}
    `;
    queryParams.push(limit);

    const result = await query<{ path: string; views: string; unique_visitors: string }>(sql, queryParams);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        path: row.path,
        views: parseInt(row.views, 10),
        unique_visitors: parseInt(row.unique_visitors, 10),
      })),
      filters: {
        limit,
        startDate,
        endDate,
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to retrieve top pages', err);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve top pages',
    });
  }
});

export { router as analyticsRouter };
