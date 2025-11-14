import express from 'express';
import request from 'supertest';
import router from '../settings-public';

jest.mock('../../db', () => ({
  query: jest.fn(),
}));

jest.mock('../../instrument', () => ({
  Sentry: {},
  isSentryEnabled: false,
}));

const { query } = jest.requireMock('../../db');

const buildApp = () => {
  const app = express();
  app.use('/api/settings/public', router);
  return app;
};

// Mock Date.now to control cache expiration
let mockNow = Date.now();
const realDateNow = Date.now.bind(global.Date);

describe('comp_settings-public route', () => {
  beforeAll(() => {
    global.Date.now = jest.fn(() => mockNow);
  });

  afterAll(() => {
    global.Date.now = realDateNow;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Invalidate cache by advancing time past cache expiration (60 seconds)
    mockNow += 61000;
  });

  it('returns parsed public settings', async () => {
    query.mockResolvedValue({
      rows: [
        { key: 'site_name', value: JSON.stringify('Demo Site') },
        { key: 'language', value: JSON.stringify('fr') },
      ],
    });

    const app = buildApp();
    const res = await request(app).get('/api/settings/public');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      site_name: 'Demo Site',
      site_description: '',
      site_url: '',
      language: 'fr',
    });
    expect(query).toHaveBeenCalledWith(
      'SELECT key, value FROM system_settings WHERE key = ANY($1::text[])',
      [['site_name', 'site_description', 'site_url', 'language']]
    );
  });

  it('returns defaults on empty result', async () => {
    query.mockResolvedValue({ rows: [] });

    const app = buildApp();
    const res = await request(app).get('/api/settings/public');

    expect(res.status).toBe(200);
    expect(res.body.site_name).toBe('Kevin Althaus');
    expect(res.body.language).toBe('en');
  });

  it('handles database errors', async () => {
    query.mockRejectedValue(new Error('db failed'));

    const app = buildApp();
    const res = await request(app).get('/api/settings/public');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to fetch public settings' });
  });
});
