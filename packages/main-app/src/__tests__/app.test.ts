import request from 'supertest';
import app from '../index';
import { closePool } from '../db';
import { getServer } from '../server';

interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
  version?: string;
  uptime?: number;
}

describe('Main App', () => {
  beforeAll(async () => {
    // Ensure DB is reachable and health check succeeds before running tests
    try {
      const response = await request(app).get('/health');
      if (response.status !== 200) {
        throw new Error(`Health check failed with status ${response.status}: ${JSON.stringify(response.body)}`);
      }
    } catch (error) {
      // Fail fast with clear error message if health check fails
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Test setup failed: Health check endpoint not accessible or unhealthy. ${errorMessage}`);
    }
  });

  afterAll(async () => {
    // Close DB pool and stop server if running to avoid open handles
    try {
      await closePool();
    } catch (error) {
      // Log teardown errors but don't fail the test suite
      console.warn('Error during pool cleanup:', error);
    }
    const server = getServer?.();
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    jest.clearAllTimers();
    jest.clearAllMocks();
  });
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health').expect(200);

      const body = response.body as HealthResponse;
      expect(body).toMatchObject({
        status: 'healthy',
        service: 'main-app',
      });
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('GET /', () => {
    it('should return app information', async () => {
      const response = await request(app).get('/').expect(200);

      expect(response.body).toMatchObject({
        message: 'Kevin Althaus Main Application',
        version: '1.0.0',
      });
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/nonexistent-route').expect(404);

      expect(response.body).toMatchObject({
        error: 'Not Found',
        message: 'Route /nonexistent-route not found',
        statusCode: 404,
      });
    });

    it('should return 404 for unknown POST routes', async () => {
      const response = await request(app).post('/unknown').expect(404);

      expect(response.body).toMatchObject({
        error: 'Not Found',
        statusCode: 404,
      });
    });
  });
});
