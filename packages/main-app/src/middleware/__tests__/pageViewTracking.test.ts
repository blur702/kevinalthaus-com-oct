/**
 * @jest-environment node
 */

import type { Request, Response, NextFunction } from 'express';
import { pageViewTrackingMiddleware } from '../pageViewTracking';
import { analyticsService } from '../../services/analyticsServiceRegistry';

jest.mock('../../services/analyticsServiceRegistry', () => {
  const createSession = jest.fn();
  const updateSession = jest.fn();
  const recordPageView = jest.fn();

  return {
    analyticsService: {
      createSession,
      updateSession,
      recordPageView,
    },
  };
});

type AnalyticsServiceMock = {
  createSession: jest.Mock;
  updateSession: jest.Mock;
  recordPageView: jest.Mock;
};

const analyticsServiceMock = analyticsService as unknown as AnalyticsServiceMock;

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    path: '/test-path',
    originalUrl: '/test-path',
    url: '/test-path',
    query: {},
    headers: {},
    cookies: {},
    ip: '127.0.0.1',
    ...overrides,
  } as Request;
}

function createMockRes(): Response & {
  cookiesSet: Record<string, { value: string; options: unknown }>;
} {
  const cookiesSet: Record<string, { value: string; options: unknown }> = {};

  return {
    cookiesSet,
    cookie: jest.fn((name: string, value: string, options: unknown) => {
      cookiesSet[name] = { value, options };
    }),
  } as unknown as Response & {
    cookiesSet: Record<string, { value: string; options: unknown }>;
  };
}

const flushPromises = async (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('pageViewTrackingMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANALYTICS_ENABLED = 'true';
    process.env.ANALYTICS_TRACK_AUTHENTICATED = 'true';
  });

  it('creates a new session and records a page view', async () => {
    analyticsServiceMock.createSession.mockResolvedValue({
      id: 'session-123',
    });
    analyticsServiceMock.recordPageView.mockResolvedValue({});

    const req = createMockReq({
      originalUrl: '/home?utm_source=news',
      url: '/home?utm_source=news',
      path: '/home',
      query: { utm_source: 'news' },
      headers: {
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        referer: 'https://example.com/blog',
      },
      cookies: {},
      ip: '192.168.1.55',
    });
    const res = createMockRes();
    const next = jest.fn() as NextFunction;

    pageViewTrackingMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    await flushPromises();

    expect(analyticsServiceMock.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        anonymous_id: expect.any(String),
        device_type: 'mobile',
        landing_page: '/home?utm_source=news',
        referrer_source: 'news',
      })
    );

    expect(analyticsServiceMock.recordPageView).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: 'session-123',
        page_path: '/home',
      })
    );

    expect(res.cookie).toHaveBeenCalledWith('ka_analytics_sid', 'session-123', expect.any(Object));
    expect(res.cookie).toHaveBeenCalledWith('ka_analytics_aid', expect.any(String), expect.any(Object));
  });

  it('reuses an existing session and updates it', async () => {
    analyticsServiceMock.updateSession.mockResolvedValue(null);
    analyticsServiceMock.recordPageView.mockResolvedValue({});

    const req = createMockReq({
      path: '/about',
      cookies: {
        ka_analytics_sid: '11111111-1111-4111-8111-111111111111',
        ka_analytics_aid: '22222222-2222-4222-8222-222222222222',
      },
    });
    const res = createMockRes();
    const next = jest.fn() as NextFunction;

    pageViewTrackingMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    await flushPromises();

    expect(analyticsServiceMock.createSession).not.toHaveBeenCalled();
    expect(analyticsServiceMock.updateSession).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      expect.objectContaining({
        exit_page: '/about',
      })
    );
    expect(analyticsServiceMock.recordPageView).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: '11111111-1111-4111-8111-111111111111',
        page_path: '/about',
      })
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'ka_analytics_sid',
      '11111111-1111-4111-8111-111111111111',
      expect.any(Object)
    );
  });
});
