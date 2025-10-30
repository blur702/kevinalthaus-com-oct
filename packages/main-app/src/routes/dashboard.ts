import { Router, Response } from 'express';
import { query } from '../db';
import { createLogger, LogLevel } from '@monorepo/shared';
import { Role } from '@monorepo/shared';
import { AuthenticatedRequest, authMiddleware } from '../auth';
import { requireRole } from '../auth/rbac-middleware';

const logger = createLogger({
  level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
  service: 'main-app',
  format: (process.env.LOG_FORMAT as 'json' | 'text') || 'text',
});

const router = Router();

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(requireRole(Role.ADMIN));

// GET /api/dashboard/stats - Get dashboard statistics
router.get(
  '/stats',
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Get total users count
      const usersResult = await query<{ count: string }>(
        'SELECT COUNT(*) as count FROM users',
        []
      );
      const totalUsers = parseInt(usersResult.rows[0].count, 10);

      // Get users count from 30 days ago for growth calculation
      const usersThirtyDaysAgoResult = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM users
         WHERE created_at <= NOW() - INTERVAL '30 days'`,
        []
      );
      const usersThirtyDaysAgo = parseInt(usersThirtyDaysAgoResult.rows[0].count, 10);

      // Calculate user growth percentage
      let usersChange = '+0%';
      if (usersThirtyDaysAgo > 0) {
        const usersGrowth = ((totalUsers - usersThirtyDaysAgo) / usersThirtyDaysAgo) * 100;
        usersChange = usersGrowth >= 0 ? `+${usersGrowth.toFixed(1)}%` : `${usersGrowth.toFixed(1)}%`;
      } else if (totalUsers > 0) {
        usersChange = '+100%';
      }

      // Check if page_views table exists
      const pageViewsTableCheck = await query<{ exists: boolean }>(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'page_views'
        )`,
        []
      );

      let pageViews = 0;
      let viewsChange = '+0%';

      if (pageViewsTableCheck.rows[0].exists) {
        // Get total page views count
        const viewsResult = await query<{ count: string }>(
          'SELECT COUNT(*) as count FROM page_views',
          []
        );
        pageViews = parseInt(viewsResult.rows[0].count, 10);

        // Get page views from 30 days ago
        const viewsThirtyDaysAgoResult = await query<{ count: string }>(
          `SELECT COUNT(*) as count FROM page_views
           WHERE created_at <= NOW() - INTERVAL '30 days'`,
          []
        );
        const viewsThirtyDaysAgo = parseInt(viewsThirtyDaysAgoResult.rows[0].count, 10);

        // Calculate views growth percentage
        if (viewsThirtyDaysAgo > 0) {
          const viewsGrowth = ((pageViews - viewsThirtyDaysAgo) / viewsThirtyDaysAgo) * 100;
          viewsChange = viewsGrowth >= 0 ? `+${viewsGrowth.toFixed(1)}%` : `${viewsGrowth.toFixed(1)}%`;
        } else if (pageViews > 0) {
          viewsChange = '+100%';
        }
      }

      // Check if articles table exists
      const articlesTableCheck = await query<{ exists: boolean }>(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'articles'
        )`,
        []
      );

      let articles = 0;
      let articlesChange = '+0%';
      let articlesThirtyDaysAgo = 0;

      if (articlesTableCheck.rows[0].exists) {
        // Get total articles count
        const articlesResult = await query<{ count: string }>(
          'SELECT COUNT(*) as count FROM articles',
          []
        );
        articles = parseInt(articlesResult.rows[0].count, 10);

        // Get articles from 30 days ago
        const articlesThirtyDaysAgoResult = await query<{ count: string }>(
          `SELECT COUNT(*) as count FROM articles
           WHERE created_at <= NOW() - INTERVAL '30 days'`,
          []
        );
        articlesThirtyDaysAgo = parseInt(articlesThirtyDaysAgoResult.rows[0].count, 10);

        // Calculate articles growth percentage
        if (articlesThirtyDaysAgo > 0) {
          const articlesGrowth = ((articles - articlesThirtyDaysAgo) / articlesThirtyDaysAgo) * 100;
          articlesChange = articlesGrowth >= 0 ? `+${articlesGrowth.toFixed(1)}%` : `${articlesGrowth.toFixed(1)}%`;
        } else if (articles > 0) {
          articlesChange = '+100%';
        }
      }

      // Calculate overall growth metric (weighted average of user and content growth)
      // This is a simplified metric - adjust weights as needed
      const growthMetrics: number[] = [];

      if (usersThirtyDaysAgo > 0) {
        growthMetrics.push(((totalUsers - usersThirtyDaysAgo) / usersThirtyDaysAgo) * 100);
      }

      // Reuse the articlesThirtyDaysAgo count computed earlier (lines 110-115)
      if (articlesTableCheck.rows[0].exists && articlesThirtyDaysAgo > 0) {
        growthMetrics.push(((articles - articlesThirtyDaysAgo) / articlesThirtyDaysAgo) * 100);
      }

      let growth = 0;
      let growthChange = '+0%';

      if (growthMetrics.length > 0) {
        growth = growthMetrics.reduce((sum, val) => sum + val, 0) / growthMetrics.length;
        growthChange = growth >= 0 ? `+${growth.toFixed(1)}%` : `${growth.toFixed(1)}%`;
      }

      res.json({
        totalUsers,
        pageViews,
        articles,
        growth: parseFloat(growth.toFixed(1)),
        changes: {
          users: usersChange,
          views: viewsChange,
          articles: articlesChange,
          growth: growthChange,
        },
      });
    } catch (error) {
      logger.error('Dashboard stats error', error as Error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch dashboard statistics',
      });
    }
  }
);

export { router as dashboardRouter };
