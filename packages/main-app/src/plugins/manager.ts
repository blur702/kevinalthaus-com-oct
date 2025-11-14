/**
 * Plugin Manager
 *
 * Manages plugin lifecycle with error isolation and circuit breaker protection.
 * Ensures plugin failures NEVER crash the main system.
 */

import {
  PluginExecutor,
  pluginExecutor,
  type PluginExecutionContext,
  type PluginExecutionResult,
  type Plugin,
} from './PluginExecutor';
import type { PluginLogger } from '@monorepo/shared';
import type { IBlogService, IAnalyticsService } from '@monorepo/shared';

interface DiscoveredPlugin {
  name: string;
  manifest?: {
    name?: string;
    displayName?: string;
    version?: string;
    description?: string;
  };
}

interface RegistryEntry {
  id: string;
  status: 'installed' | 'active' | 'inactive';
  plugin?: Plugin;
}

/**
 * Plugin Manager
 *
 * Manages plugin lifecycle with comprehensive error isolation:
 * - Try-catch wrappers around all plugin execution
 * - Circuit breaker pattern (auto-disable after failures)
 * - Timeout protection
 * - Health monitoring
 * - Service injection for centralized data access
 */
class PluginManager {
  private discovered: DiscoveredPlugin[] = [];
  private registry: RegistryEntry[] = [];
  private executor: PluginExecutor;
  private services: {
    blog?: IBlogService;
    editor?: unknown;
    taxonomy?: unknown;
    email?: unknown;
    analytics?: IAnalyticsService;
  } = {};

  constructor() {
    this.executor = pluginExecutor;
  }

  init(): void {
    console.log('[PluginManager] Initialized with error isolation enabled');
  }

  /**
   * Set centralized services (for dependency injection)
   */
  setServices(services: {
    blog?: IBlogService;
    editor?: unknown;
    taxonomy?: unknown;
    email?: unknown;
    storage?: unknown;
    analytics?: IAnalyticsService;
  }): void {
    this.services = services;
    console.log('[PluginManager] Services injected:', Object.keys(services));
  }

  /**
   * Execute a plugin with error isolation
   */
  async executePlugin(
    id: string,
    context: Partial<PluginExecutionContext>,
    logger: PluginLogger
  ): Promise<PluginExecutionResult> {
    const entry = this.registry.find((r) => r.id === id);

    if (!entry) {
      return {
        success: false,
        error: 'Plugin not found',
        executionTime: 0,
      };
    }

    if (entry.status !== 'active') {
      return {
        success: false,
        error: 'Plugin is not active',
        executionTime: 0,
      };
    }

    if (!entry.plugin) {
      return {
        success: false,
        error: 'Plugin handler not loaded',
        executionTime: 0,
      };
    }

    // Build full execution context with injected services
    const fullContext: PluginExecutionContext = {
      user: context.user || { id: '', email: '', role: '' },
      services: {
        blog: this.services.blog || null,
        editor: this.services.editor || null,
        taxonomy: this.services.taxonomy || null,
        email: this.services.email || null,
        analytics: this.services.analytics || null,
      },
      logger,
      config: context.config || {},
      request: context.request,
    };

    // Execute with comprehensive error isolation
    return this.executor.executePlugin(entry.plugin, fullContext);
  }

  /**
   * Check health of a plugin
   */
  async checkPluginHealth(id: string, logger: PluginLogger): Promise<{
    healthy: boolean;
    message?: string;
  }> {
    const entry = this.registry.find((r) => r.id === id);

    if (!entry) {
      return {
        healthy: false,
        message: 'Plugin not found',
      };
    }

    if (!entry.plugin) {
      return {
        healthy: false,
        message: 'Plugin handler not loaded',
      };
    }

    const context: PluginExecutionContext = {
      user: { id: 'system', email: 'system@system', role: 'admin' },
      services: {
        blog: this.services.blog || null,
        editor: this.services.editor || null,
        taxonomy: this.services.taxonomy || null,
        email: this.services.email || null,
        analytics: this.services.analytics || null,
      },
      logger,
      config: {},
    };

    return this.executor.healthCheck(entry.plugin, context);
  }

  /**
   * Get circuit breaker stats for a plugin
   */
  getPluginStats(id: string): {
    failures: number;
    isOpen: boolean;
    lastFailureTime: number | null;
  } | null {
    const entry = this.registry.find((r) => r.id === id);
    if (!entry) {
      return null;
    }

    return this.executor.getCircuitStats(id);
  }

  /**
   * Manually reset circuit breaker for a plugin (admin operation)
   */
  resetPluginCircuit(id: string): void {
    this.executor.manualResetCircuit(id);
    console.log(`[PluginManager] Circuit breaker reset for plugin: ${id}`);
  }

  listDiscovered(): DiscoveredPlugin[] {
    return this.discovered;
  }

  listRegistry(): RegistryEntry[] {
    return this.registry;
  }

  install(id: string): Promise<void> {
    if (!this.registry.find((r) => r.id === id)) {
      this.registry.push({ id, status: 'installed' });
      console.log(`[PluginManager] Plugin installed: ${id}`);
    }
    return Promise.resolve();
  }

  activate(id: string): Promise<void> {
    const entry = this.registry.find((r) => r.id === id);
    if (entry) {
      entry.status = 'active';
      console.log(`[PluginManager] Plugin activated: ${id}`);
    }
    return Promise.resolve();
  }

  deactivate(id: string): Promise<void> {
    const entry = this.registry.find((r) => r.id === id);
    if (entry) {
      entry.status = 'inactive';
      console.log(`[PluginManager] Plugin deactivated: ${id}`);
    }
    return Promise.resolve();
  }

  uninstall(id: string): Promise<void> {
    this.registry = this.registry.filter((r) => r.id !== id);
    console.log(`[PluginManager] Plugin uninstalled: ${id}`);
    return Promise.resolve();
  }

  /**
   * Register a plugin with handler
   */
  registerPlugin(id: string, plugin: Plugin): void {
    const entry = this.registry.find((r) => r.id === id);
    if (entry) {
      entry.plugin = plugin;
      console.log(`[PluginManager] Plugin handler registered: ${id}`);
    } else {
      this.registry.push({ id, status: 'installed', plugin });
      console.log(`[PluginManager] Plugin installed and registered: ${id}`);
    }
  }
}

export const pluginManager = new PluginManager();
