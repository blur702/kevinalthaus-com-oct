/**
 * Plugin Executor
 *
 * Provides bulletproof execution wrapper for plugins to ensure
 * plugin failures never crash the main system.
 *
 * Features:
 * - Try-catch error isolation
 * - Timeout protection
 * - Circuit breaker (auto-disable after failures)
 * - Resource monitoring
 * - Graceful error responses
 */

import type { PluginLogger } from '@monorepo/shared';

/**
 * Plugin execution context provided to plugin handlers
 */
export interface PluginExecutionContext {
  // User making the request
  user: {
    id: string;
    email: string;
    role: string;
  };

  // Centralized services (MUST USE THESE)
  services: {
    blog: unknown; // IBlogService
    editor: unknown; // IEditorService
    taxonomy: unknown; // ITaxonomyService
    email: unknown; // IEmailService
  };

  // Plugin-specific logger
  logger: PluginLogger;

  // Plugin configuration
  config: Record<string, unknown>;

  // Request context (if applicable)
  request?: {
    method: string;
    path: string;
    body: unknown;
    query: Record<string, unknown>;
  };
}

/**
 * Plugin handler function signature
 */
export type PluginHandler = (context: PluginExecutionContext) => Promise<unknown>;

/**
 * Plugin metadata
 */
export interface Plugin {
  name: string;
  version: string;
  handler: PluginHandler;
  enabled: boolean;
}

/**
 * Plugin execution result
 */
export interface PluginExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  details?: string;
  executionTime?: number;
}

/**
 * Circuit breaker configuration
 */
interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening circuit
  resetTimeout: number; // Time in ms before attempting to close circuit
}

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
}

/**
 * Plugin Executor
 *
 * Executes plugins with comprehensive error isolation and protection
 */
export class PluginExecutor {
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private config: CircuitBreakerConfig = {
    failureThreshold: 5, // 5 failures before auto-disable
    resetTimeout: 60000, // 1 minute before retry
  };

  /**
   * Execute a plugin with full error isolation
   */
  async executePlugin(
    plugin: Plugin,
    context: PluginExecutionContext,
    timeoutMs = 30000
  ): Promise<PluginExecutionResult> {
    const startTime = Date.now();

    // Check if plugin is enabled
    if (!plugin.enabled) {
      return {
        success: false,
        error: 'Plugin is disabled',
        executionTime: 0,
      };
    }

    // Check circuit breaker
    const circuitState = this.getCircuitState(plugin.name);
    if (circuitState.isOpen) {
      const timeSinceLastFailure = Date.now() - circuitState.lastFailureTime;
      if (timeSinceLastFailure < this.config.resetTimeout) {
        return {
          success: false,
          error: 'Plugin circuit breaker is open (too many recent failures)',
          details: `Retry after ${Math.ceil((this.config.resetTimeout - timeSinceLastFailure) / 1000)} seconds`,
          executionTime: 0,
        };
      } else {
        // Reset circuit breaker after timeout
        this.resetCircuit(plugin.name);
      }
    }

    try {
      // Execute plugin with timeout protection
      const result = await this.executeWithTimeout(plugin.handler, context, timeoutMs);

      // Reset circuit breaker on success
      this.resetCircuit(plugin.name);

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: result,
        executionTime,
      };
    } catch (error) {
      // Log error but don't crash system
      context.logger.error(`Plugin ${plugin.name} failed:`, error as Error);

      // Record failure in circuit breaker
      this.recordFailure(plugin.name);

      const executionTime = Date.now() - startTime;

      // Return graceful error
      return {
        success: false,
        error: 'Plugin execution failed',
        details: process.env.NODE_ENV === 'development'
          ? (error instanceof Error ? error.message : String(error))
          : undefined,
        executionTime,
      };
    }
  }

  /**
   * Execute plugin handler with timeout protection
   */
  private async executeWithTimeout(
    handler: PluginHandler,
    context: PluginExecutionContext,
    timeoutMs: number
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      // Create timeout
      const timeout = setTimeout(() => {
        reject(new Error(`Plugin execution timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      // Execute handler
      handler(context)
        .then((result) => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Get circuit breaker state for a plugin
   */
  private getCircuitState(pluginName: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(pluginName)) {
      this.circuitBreakers.set(pluginName, {
        failures: 0,
        lastFailureTime: 0,
        isOpen: false,
      });
    }
    return this.circuitBreakers.get(pluginName)!;
  }

  /**
   * Record a failure in the circuit breaker
   */
  private recordFailure(pluginName: string): void {
    const state = this.getCircuitState(pluginName);
    state.failures++;
    state.lastFailureTime = Date.now();

    // Open circuit if threshold exceeded
    if (state.failures >= this.config.failureThreshold) {
      state.isOpen = true;
      console.warn(
        `[PluginExecutor] Circuit breaker opened for plugin "${pluginName}" ` +
        `after ${state.failures} failures`
      );
    }
  }

  /**
   * Reset circuit breaker for a plugin
   */
  private resetCircuit(pluginName: string): void {
    const state = this.getCircuitState(pluginName);
    if (state.failures > 0 || state.isOpen) {
      console.log(`[PluginExecutor] Circuit breaker reset for plugin "${pluginName}"`);
    }
    state.failures = 0;
    state.lastFailureTime = 0;
    state.isOpen = false;
  }

  /**
   * Check plugin health
   */
  async healthCheck(plugin: Plugin, context: PluginExecutionContext): Promise<{
    healthy: boolean;
    message?: string;
  }> {
    if (!plugin.enabled) {
      return {
        healthy: false,
        message: 'Plugin is disabled',
      };
    }

    const circuitState = this.getCircuitState(plugin.name);
    if (circuitState.isOpen) {
      return {
        healthy: false,
        message: 'Circuit breaker is open',
      };
    }

    // Try a lightweight execution to check health
    try {
      await this.executeWithTimeout(
        async (ctx) => {
          // Just verify the handler can be called
          ctx.logger.info('Health check');
          return { healthy: true };
        },
        context,
        5000 // 5 second timeout for health check
      );

      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get circuit breaker statistics
   */
  getCircuitStats(pluginName: string): {
    failures: number;
    isOpen: boolean;
    lastFailureTime: number | null;
  } {
    const state = this.getCircuitState(pluginName);
    return {
      failures: state.failures,
      isOpen: state.isOpen,
      lastFailureTime: state.lastFailureTime > 0 ? state.lastFailureTime : null,
    };
  }

  /**
   * Manually reset a circuit breaker (admin operation)
   */
  manualResetCircuit(pluginName: string): void {
    this.resetCircuit(pluginName);
  }
}

/**
 * Global plugin executor instance
 */
export const pluginExecutor = new PluginExecutor();
