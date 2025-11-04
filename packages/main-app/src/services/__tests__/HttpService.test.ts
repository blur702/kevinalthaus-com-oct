/**
 * HttpService Tests
 *
 * Tests for HTTP client service functionality.
 */

import { HttpService } from '../HttpService';
import nock from 'nock';

describe('HttpService', () => {
  let httpService: HttpService;
  const testUrl = 'https://api.example.com';

  beforeEach(async () => {
    httpService = new HttpService();
    await httpService.initialize();
  });

  afterEach(async () => {
    await httpService.shutdown();
    nock.cleanAll();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const service = new HttpService();
      await expect(service.initialize()).resolves.not.toThrow();
      await service.shutdown();
    });

    it('should not allow double initialization', async () => {
      await expect(httpService.initialize()).rejects.toThrow('HttpService is already initialized');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy when initialized', async () => {
      const health = await httpService.healthCheck();
      expect(health).toEqual({ healthy: true });
    });

    it('should return unhealthy when not initialized', async () => {
      const service = new HttpService();
      const health = await service.healthCheck();
      expect(health).toEqual({
        healthy: false,
        message: 'Service not initialized',
      });
    });
  });

  describe('GET request', () => {
    it('should make successful GET request', async () => {
      const mockData = { id: 1, name: 'Test' };

      nock(testUrl).get('/users/1').reply(200, mockData);

      const response = await httpService.get(`${testUrl}/users/1`);

      expect(response.status).toBe(200);
      expect(response.data).toEqual(mockData);
    });

    it('should handle GET request with query params', async () => {
      const mockData = [{ id: 1 }, { id: 2 }];

      nock(testUrl).get('/users').query({ page: '1', limit: '10' }).reply(200, mockData);

      const response = await httpService.get(`${testUrl}/users`, {
        params: { page: 1, limit: 10 },
      });

      expect(response.status).toBe(200);
      expect(response.data).toEqual(mockData);
    });

    it('should handle GET request with custom headers', async () => {
      nock(testUrl)
        .get('/users')
        .matchHeader('Authorization', 'Bearer token123')
        .reply(200, { success: true });

      const response = await httpService.get(`${testUrl}/users`, {
        headers: { Authorization: 'Bearer token123' },
      });

      expect(response.status).toBe(200);
      expect(response.data).toEqual({ success: true });
    });
  });

  describe('POST request', () => {
    it('should make successful POST request', async () => {
      const postData = { name: 'New User', email: 'user@example.com' };
      const mockResponse = { id: 1, ...postData };

      nock(testUrl).post('/users', postData).reply(201, mockResponse);

      const response = await httpService.post(`${testUrl}/users`, postData);

      expect(response.status).toBe(201);
      expect(response.data).toEqual(mockResponse);
    });
  });

  describe('PUT request', () => {
    it('should make successful PUT request', async () => {
      const updateData = { name: 'Updated Name' };
      const mockResponse = { id: 1, ...updateData };

      nock(testUrl).put('/users/1', updateData).reply(200, mockResponse);

      const response = await httpService.put(`${testUrl}/users/1`, updateData);

      expect(response.status).toBe(200);
      expect(response.data).toEqual(mockResponse);
    });
  });

  describe('PATCH request', () => {
    it('should make successful PATCH request', async () => {
      const patchData = { name: 'Patched Name' };
      const mockResponse = { id: 1, ...patchData };

      nock(testUrl).patch('/users/1', patchData).reply(200, mockResponse);

      const response = await httpService.patch(`${testUrl}/users/1`, patchData);

      expect(response.status).toBe(200);
      expect(response.data).toEqual(mockResponse);
    });
  });

  describe('DELETE request', () => {
    it('should make successful DELETE request', async () => {
      nock(testUrl).delete('/users/1').reply(204);

      const response = await httpService.delete(`${testUrl}/users/1`);

      expect(response.status).toBe(204);
    });
  });

  describe('Error handling', () => {
    it('should handle 404 errors', async () => {
      nock(testUrl).get('/nonexistent').reply(404, { error: 'Not found' });

      await expect(httpService.get(`${testUrl}/nonexistent`)).rejects.toThrow();
    });

    it('should handle 500 errors', async () => {
      nock(testUrl).get('/error').reply(500, { error: 'Internal server error' });

      await expect(httpService.get(`${testUrl}/error`)).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      nock(testUrl).get('/timeout').replyWithError('Network timeout');

      await expect(httpService.get(`${testUrl}/timeout`)).rejects.toThrow();
    });
  });

  describe('Configuration methods', () => {
    it('should set default header', () => {
      httpService.setDefaultHeader('Authorization', 'Bearer test-token');
      // Verify by making a request that checks for the header
      nock(testUrl)
        .get('/test')
        .matchHeader('Authorization', 'Bearer test-token')
        .reply(200, { success: true });

      return expect(httpService.get(`${testUrl}/test`)).resolves.toBeDefined();
    });

    it('should set base URL', async () => {
      httpService.setBaseURL(testUrl);

      nock(testUrl).get('/users').reply(200, { success: true });

      const response = await httpService.get('/users');
      expect(response.status).toBe(200);
    });
  });

  describe('Interceptors', () => {
    it('should add request interceptor', async () => {
      let interceptorCalled = false;

      httpService.addRequestInterceptor((config) => {
        interceptorCalled = true;
        return config;
      });

      nock(testUrl).get('/test').reply(200);

      await httpService.get(`${testUrl}/test`);
      expect(interceptorCalled).toBe(true);
    });

    it('should add response interceptor', async () => {
      let interceptorCalled = false;

      httpService.addResponseInterceptor((response) => {
        interceptorCalled = true;
        return response;
      });

      nock(testUrl).get('/test').reply(200, { data: 'test' });

      await httpService.get(`${testUrl}/test`);
      expect(interceptorCalled).toBe(true);
    });
  });

  describe('Uninitialized error handling', () => {
    it('should throw error when making GET request without initialization', async () => {
      const service = new HttpService();
      await expect(service.get(`${testUrl}/test`)).rejects.toThrow('HttpService not initialized');
    });

    it('should throw error when setting default header without initialization', () => {
      const service = new HttpService();
      expect(() => service.setDefaultHeader('Test', 'Value')).toThrow('HttpService not initialized');
    });
  });
});
