/**
 * Centralized Port Configuration
 *
 * Single source of truth for all service port assignments across the monorepo.
 * All services should import from this file rather than hardcoding port numbers.
 *
 * Port Layout:
 * - 3000: API Gateway (entry point for all requests)
 * - 3001: Frontend (public-facing website)
 * - 3002: Admin Dashboard
 * - 3003: Main App (core backend service)
 * - 3004: Plugin Engine
 * - 8000: Python Service (external)
 */

export const PORTS = {
  /**
   * API Gateway - Entry point for all HTTP requests
   * Proxies requests to appropriate backend services
   */
  API_GATEWAY: 3000,

  /**
   * Frontend - Public-facing website built with Vite + React
   * Serves the main public interface
   */
  FRONTEND: 3001,

  /**
   * Admin Dashboard - Administrative interface built with Vite + React
   * Provides content management and configuration UI
   */
  ADMIN: 3002,

  /**
   * Main App - Core backend service
   * Handles database operations, authentication, and business logic
   */
  MAIN_APP: 3003,

  /**
   * Plugin Engine - Plugin runtime and API
   * Manages and executes plugins
   */
  PLUGIN_ENGINE: 3004,

  /**
   * Python Service - External Python-based service
   * Handles specialized processing tasks
   */
  PYTHON_SERVICE: 8000,
} as const;

/**
 * Type representing any valid service port
 */
export type ServicePort = typeof PORTS[keyof typeof PORTS];

/**
 * Type representing service names
 */
export type ServiceName = keyof typeof PORTS;

/**
 * Get port number for a specific service
 *
 * @param service - Service name (e.g., 'API_GATEWAY', 'FRONTEND')
 * @returns Port number for the service
 *
 * @example
 * ```typescript
 * const port = getPortForService('API_GATEWAY'); // returns 3000
 * ```
 */
export function getPortForService(service: ServiceName): number {
  return PORTS[service];
}

/**
 * Get service name from port number
 *
 * @param port - Port number
 * @returns Service name or undefined if port is not assigned
 *
 * @example
 * ```typescript
 * const service = getServiceForPort(3000); // returns 'API_GATEWAY'
 * ```
 */
export function getServiceForPort(port: number): ServiceName | undefined {
  const entries = Object.entries(PORTS) as [ServiceName, number][];
  const found = entries.find(([, p]) => p === port);
  return found?.[0];
}

/**
 * Check if a port is assigned to a service
 *
 * @param port - Port number to check
 * @returns True if port is assigned
 *
 * @example
 * ```typescript
 * isAssignedPort(3000); // true
 * isAssignedPort(9999); // false
 * ```
 */
export function isAssignedPort(port: number): boolean {
  return Object.values(PORTS).includes(port as ServicePort);
}

/**
 * Get all assigned ports as an array
 *
 * @returns Array of all port numbers
 *
 * @example
 * ```typescript
 * const ports = getAllPorts(); // [3000, 3001, 3002, 3003, 3004, 8000]
 * ```
 */
export function getAllPorts(): number[] {
  return Object.values(PORTS);
}

/**
 * Get port configuration as a map
 *
 * @returns Map of service names to port numbers
 *
 * @example
 * ```typescript
 * const portMap = getPortMap();
 * // Map { 'API_GATEWAY' => 3000, 'FRONTEND' => 3001, ... }
 * ```
 */
export function getPortMap(): Map<ServiceName, number> {
  const entries = Object.entries(PORTS) as [ServiceName, number][];
  return new Map(entries);
}
