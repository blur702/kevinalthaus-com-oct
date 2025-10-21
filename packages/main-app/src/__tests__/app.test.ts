import request from 'supertest';
import app from '../index';

interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
  version?: string;
  uptime?: number;
}

describe('Main App', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      const body = response.body as HealthResponse;
      expect(body).toMatchObject({
        status: 'healthy',
        service: 'main-app'
      });
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('GET /', () => {
    it('should return app information', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Kevin Althaus Main Application',
        version: '1.0.0'
      });
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/nonexistent-route')
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Not Found',
        message: 'Route /nonexistent-route not found',
        statusCode: 404
      });
    });

    it('should return 404 for unknown POST routes', async () => {
      const response = await request(app)
        .post('/unknown')
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Not Found',
        statusCode: 404
      });
    });
  });
});