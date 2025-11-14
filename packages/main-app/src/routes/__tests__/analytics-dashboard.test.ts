import express from 'express';
import request from 'supertest';

jest.mock('../../auth', () => ({
  authMiddleware: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  AuthenticatedRequest: jest.fn(),
}));

jest.mock('../../auth/rbac-middleware', () => ({
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

// Mock database query function
jest.mock('../../db', () => ({
  query: jest.fn(),
}));

type AnalyticsServiceMock = {
  getSessionSummary: jest.Mock;
  getTopEvents: jest.Mock;
  getTopPages: jest.Mock;
  listGoals: jest.Mock;
  listFunnels: jest.Mock;
  getEventStream: jest.Mock;
  getSessionTimeline: jest.Mock;
};

const analyticsServiceMock: AnalyticsServiceMock = {
  getSessionSummary: jest.fn(),
  getTopEvents: jest.fn(),
  getTopPages: jest.fn(),
  listGoals: jest.fn(),
  listFunnels: jest.fn(),
  getEventStream: jest.fn(),
  getSessionTimeline: jest.fn(),
};

jest.mock('../../services/analyticsServiceRegistry', () => ({
  analyticsService: analyticsServiceMock,
}));

import { analyticsRouter } from '../analytics';
import { query } from '../../db';

const queryMock = query as jest.MockedFunction<typeof query>;

describe('Analytics Dashboard API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /dashboard/overview', () => {
    it('returns aggregated dashboard data', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api/analytics', analyticsRouter);

      const response = await request(app).get('/api/analytics/dashboard/overview?range=24h');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.total_sessions).toBe(0);
      expect(response.body.range.label).toBe('Last 24 hours');
    });
  });

  describe('GET /page-views/stats', () => {
    it('returns page view statistics', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '150' }] } as never)
        .mockResolvedValueOnce({ rows: [{ count: '75' }] } as never)
        .mockResolvedValueOnce({ rows: [{ count: '20' }] } as never)
        .mockResolvedValueOnce({ rows: [{ count: '50' }] } as never)
        .mockResolvedValueOnce({ rows: [{ count: '100' }] } as never)
        .mockResolvedValueOnce({ rows: [{ path: '/home', views: '45' }, { path: '/about', views: '30' }] } as never);

      const app = express();
      app.use(express.json());
      app.use('/api/analytics', analyticsRouter);

      const response = await request(app).get('/api/analytics/page-views/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.stats.total_views).toBe(150);
      expect(response.body.stats.unique_visitors).toBe(75);
      expect(response.body.stats.top_pages).toHaveLength(2);
    });
  });

  describe('GET /page-views', () => {
    it('returns page views with pagination', async () => {
      const mockPageViews = [
        {
          id: 'view-1',
          url: '/home',
          path: '/home',
          user_id: 'user-123',
          ip_address: '192.168.1.0',
          user_agent: 'Mozilla/5.0',
          referrer: 'https://google.com',
          created_at: new Date(),
        },
      ];

      queryMock
        .mockResolvedValueOnce({ rows: mockPageViews } as never)
        .mockResolvedValueOnce({ rows: [{ total: '25' }] } as never);

      const app = express();
      app.use(express.json());
      app.use('/api/analytics', analyticsRouter);

      const response = await request(app).get('/api/analytics/page-views?limit=10&offset=0');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination.total).toBe(25);
    });
  });

  describe('GET /page-views/top-pages', () => {
    it('returns top pages by view count', async () => {
      const mockTopPages = [
        { path: '/home', views: '100', unique_visitors: '80' },
        { path: '/pricing', views: '75', unique_visitors: '60' },
      ];

      queryMock.mockResolvedValueOnce({ rows: mockTopPages } as never);

      const app = express();
      app.use(express.json());
      app.use('/api/analytics', analyticsRouter);

      const response = await request(app).get('/api/analytics/page-views/top-pages?limit=10');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].views).toBe(100);
    });
  });
});
