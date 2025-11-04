/**
 * Service Container
 *
 * Manages service lifecycle and provides dependency injection for all services.
 * Implements singleton pattern - services are created once and shared across the application.
 */

import type { IService, IServiceContainer } from './interfaces';

export class ServiceContainer implements IServiceContainer {
  private services: Map<string, IService> = new Map();
  private initialized: boolean = false;

  /**
   * Register a service with the container
   */
  register<T extends IService>(name: string, service: T): void {
    if (this.services.has(name)) {
      throw new Error(`Service '${name}' is already registered`);
    }
    this.services.set(name, service);
  }

  /**
   * Get a service by name
   */
  get<T extends IService>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' is not registered`);
    }
    return service as T;
  }

  /**
   * Check if service exists
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Initialize all registered services
   */
  async initializeAll(): Promise<void> {
    if (this.initialized) {
      throw new Error('Services are already initialized');
    }

    const initPromises: Promise<void>[] = [];

    for (const [name, service] of this.services) {
      initPromises.push(
        service
          .initialize()
          .then(() => {
            console.log(`[ServiceContainer]  Initialized: ${name}`);
          })
          .catch((error) => {
            console.error(`[ServiceContainer]  Failed to initialize ${name}:`, error);
            throw new Error(`Failed to initialize service '${name}': ${error.message}`);
          })
      );
    }

    await Promise.all(initPromises);
    this.initialized = true;
    console.log(`[ServiceContainer] All ${this.services.size} services initialized successfully`);
  }

  /**
   * Shutdown all services gracefully
   */
  async shutdownAll(): Promise<void> {
    if (!this.initialized) {
      console.warn('[ServiceContainer] Services are not initialized, skipping shutdown');
      return;
    }

    const shutdownPromises: Promise<void>[] = [];

    for (const [name, service] of this.services) {
      shutdownPromises.push(
        service
          .shutdown()
          .then(() => {
            console.log(`[ServiceContainer]  Shutdown: ${name}`);
          })
          .catch((error) => {
            console.error(`[ServiceContainer]  Failed to shutdown ${name}:`, error);
            // Don't throw - continue shutting down other services
          })
      );
    }

    await Promise.all(shutdownPromises);
    this.initialized = false;
    console.log('[ServiceContainer] All services shut down');
  }

  /**
   * Get all registered service names
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Run health checks on all services
   */
  async healthCheckAll(): Promise<Map<string, { healthy: boolean; message?: string }>> {
    const results = new Map<string, { healthy: boolean; message?: string }>();

    const healthCheckPromises = Array.from(this.services.entries()).map(async ([name, service]) => {
      try {
        const result = await service.healthCheck();
        results.set(name, result);
      } catch (error) {
        results.set(name, {
          healthy: false,
          message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    });

    await Promise.all(healthCheckPromises);
    return results;
  }

  /**
   * Get initialization status
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Clear all services (for testing)
   */
  clear(): void {
    if (this.initialized) {
      throw new Error('Cannot clear services while initialized. Call shutdownAll() first.');
    }
    this.services.clear();
  }
}

// Singleton instance
let containerInstance: ServiceContainer | null = null;

/**
 * Get the global service container instance
 */
export function getServiceContainer(): ServiceContainer {
  if (!containerInstance) {
    containerInstance = new ServiceContainer();
  }
  return containerInstance;
}

/**
 * Reset the service container (for testing)
 */
export function resetServiceContainer(): void {
  if (containerInstance && containerInstance.isInitialized()) {
    throw new Error('Cannot reset service container while initialized. Call shutdownAll() first.');
  }
  containerInstance = null;
}
