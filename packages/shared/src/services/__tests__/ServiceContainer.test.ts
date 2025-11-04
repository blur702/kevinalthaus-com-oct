/**
 * ServiceContainer Tests
 *
 * Tests for dependency injection container.
 */

import { ServiceContainer } from '../ServiceContainer';
import type { IService } from '../interfaces';

// Mock service implementation for testing
class MockService implements IService {
  readonly name: string;
  private initialized = false;

  constructor(name: string) {
    this.name = name;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error(`${this.name} is already initialized`);
    }
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return {
      healthy: this.initialized,
      message: this.initialized ? undefined : 'Service not initialized',
    };
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

describe('ServiceContainer', () => {
  let container: ServiceContainer;

  beforeEach(() => {
    container = new ServiceContainer();
  });

  describe('register', () => {
    it('should register a service', () => {
      const service = new MockService('test');
      expect(() => container.register('test', service)).not.toThrow();
    });

    it('should throw error when registering duplicate service', () => {
      const service1 = new MockService('test');
      const service2 = new MockService('test');

      container.register('test', service1);
      expect(() => container.register('test', service2)).toThrow(
        "Service 'test' is already registered"
      );
    });
  });

  describe('get', () => {
    it('should retrieve a registered service', () => {
      const service = new MockService('test');
      container.register('test', service);

      const retrieved = container.get('test');
      expect(retrieved).toBe(service);
    });

    it('should throw error when getting non-existent service', () => {
      expect(() => container.get('nonexistent')).toThrow(
        "Service 'nonexistent' is not registered"
      );
    });

    it('should return correct service type', () => {
      const service = new MockService('test');
      container.register('test', service);

      const retrieved = container.get<MockService>('test');
      expect(retrieved.name).toBe('test');
      expect(retrieved.isInitialized()).toBe(false);
    });
  });

  describe('has', () => {
    it('should return true for registered service', () => {
      const service = new MockService('test');
      container.register('test', service);

      expect(container.has('test')).toBe(true);
    });

    it('should return false for non-registered service', () => {
      expect(container.has('nonexistent')).toBe(false);
    });
  });

  describe('getServiceNames', () => {
    it('should return empty array when no services registered', () => {
      const names = container.getServiceNames();
      expect(names).toEqual([]);
    });

    it('should return array of registered service names', () => {
      container.register('service1', new MockService('service1'));
      container.register('service2', new MockService('service2'));
      container.register('service3', new MockService('service3'));

      const names = container.getServiceNames();
      expect(names).toHaveLength(3);
      expect(names).toContain('service1');
      expect(names).toContain('service2');
      expect(names).toContain('service3');
    });
  });

  describe('initializeAll', () => {
    it('should initialize all registered services', async () => {
      const service1 = new MockService('service1');
      const service2 = new MockService('service2');

      container.register('service1', service1);
      container.register('service2', service2);

      await container.initializeAll();

      expect(service1.isInitialized()).toBe(true);
      expect(service2.isInitialized()).toBe(true);
    });

    it('should handle initialization failures gracefully', async () => {
      class FailingService implements IService {
        readonly name = 'failing';
        async initialize(): Promise<void> {
          throw new Error('Initialization failed');
        }
        async shutdown(): Promise<void> {}
        async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
          return { healthy: false };
        }
      }

      container.register('failing', new FailingService());

      await expect(container.initializeAll()).rejects.toThrow();
    });
  });

  describe('shutdownAll', () => {
    it('should shutdown all registered services', async () => {
      const service1 = new MockService('service1');
      const service2 = new MockService('service2');

      container.register('service1', service1);
      container.register('service2', service2);

      await container.initializeAll();
      expect(service1.isInitialized()).toBe(true);
      expect(service2.isInitialized()).toBe(true);

      await container.shutdownAll();
      expect(service1.isInitialized()).toBe(false);
      expect(service2.isInitialized()).toBe(false);
    });
  });

  describe('healthCheckAll', () => {
    it('should return health status for all services', async () => {
      const service1 = new MockService('service1');
      const service2 = new MockService('service2');

      container.register('service1', service1);
      container.register('service2', service2);

      await container.initializeAll();

      const healthMap = await container.healthCheckAll();

      expect(healthMap.get('service1')).toEqual({ healthy: true });
      expect(healthMap.get('service2')).toEqual({ healthy: true });
    });

    it('should detect unhealthy services', async () => {
      const service = new MockService('test');
      container.register('test', service);

      // Don't initialize, so it will be unhealthy
      const healthMap = await container.healthCheckAll();

      expect(healthMap.get('test')).toEqual({
        healthy: false,
        message: 'Service not initialized',
      });
    });
  });

  describe('Lifecycle workflow', () => {
    it('should handle complete lifecycle: register -> initialize -> shutdown', async () => {
      const service = new MockService('lifecycle');

      // Register
      container.register('lifecycle', service);
      expect(service.isInitialized()).toBe(false);

      // Initialize
      await container.initializeAll();
      expect(service.isInitialized()).toBe(true);

      const health1 = await service.healthCheck();
      expect(health1.healthy).toBe(true);

      // Shutdown
      await container.shutdownAll();
      expect(service.isInitialized()).toBe(false);

      const health2 = await service.healthCheck();
      expect(health2.healthy).toBe(false);
    });
  });

  describe('Multiple service types', () => {
    it('should handle multiple different service implementations', async () => {
      class AuthService implements IService {
        readonly name = 'auth';
        async initialize(): Promise<void> {}
        async shutdown(): Promise<void> {}
        async healthCheck(): Promise<{ healthy: boolean }> {
          return { healthy: true };
        }
      }

      class DatabaseService implements IService {
        readonly name = 'database';
        async initialize(): Promise<void> {}
        async shutdown(): Promise<void> {}
        async healthCheck(): Promise<{ healthy: boolean }> {
          return { healthy: true };
        }
      }

      const authService = new AuthService();
      const dbService = new DatabaseService();

      container.register('auth', authService);
      container.register('database', dbService);

      expect(container.has('auth')).toBe(true);
      expect(container.has('database')).toBe(true);

      const retrievedAuth = container.get<AuthService>('auth');
      const retrievedDb = container.get<DatabaseService>('database');

      expect(retrievedAuth.name).toBe('auth');
      expect(retrievedDb.name).toBe('database');
    });
  });
});
