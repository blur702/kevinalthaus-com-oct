import { PluginManifest } from './manifest';
import { PluginStatus } from '../constants';
import type { Pool } from 'pg';
import type { Application } from 'express';

export interface PluginLifecycleContext {
  pluginId: string;
  manifest: PluginManifest;
  pluginPath: string;
  dataPath: string;
  config?: Record<string, unknown>;
}

export interface PluginLogger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, error?: Error, metadata?: Record<string, unknown>): void;
}

export interface PluginExecutionContext extends PluginLifecycleContext {
  logger: PluginLogger;
  api: PluginAPI;
  storage: PluginStorage;
  /**
   * Database connection pool - Available only for backend/server-side plugins
   *
   * Provided only when the host runtime has initialized the database pool.
   * Frontend-only plugins will receive `undefined`.
   *
   * Use for:
   * - Running SQL queries
   * - Managing transactions
   * - Database migrations during onInstall/onUpdate
   *
   * Always check for undefined before use:
   * ```typescript
   * if (!context.db) {
   *   throw new Error('Database not available for this plugin');
   * }
   * ```
   */
  db?: Pool;
  /**
   * Express application instance - Available only for backend/server-side plugins
   *
   * Provided only when the host runtime has initialized the Express application.
   * Frontend-only plugins will receive `undefined`.
   *
   * Use for:
   * - Registering HTTP routes and middleware
   * - Adding WebSocket handlers
   * - Customizing request/response handling
   *
   * Always check for undefined before use:
   * ```typescript
   * if (!context.app) {
   *   throw new Error('Express app not available for this plugin');
   * }
   * ```
   */
  app?: Application;
}

export interface PluginLifecycleHooks {
  onInstall?(context: PluginExecutionContext): Promise<void>;
  onActivate?(context: PluginExecutionContext): Promise<void>;
  onDeactivate?(context: PluginExecutionContext): Promise<void>;
  onUninstall?(context: PluginExecutionContext): Promise<void>;
  onUpdate?(context: PluginExecutionContext, oldVersion: string): Promise<void>;
}

export interface PluginInstance {
  id: string;
  manifest: PluginManifest;
  status: PluginStatus;
  installedAt: Date;
  activatedAt?: Date;
  lastUpdatedAt?: Date;
  error?: string;
  config?: Record<string, unknown>;
}

export interface PluginAPI {
  get(url: string, options?: RequestOptions): Promise<unknown>;
  post(url: string, data?: unknown, options?: RequestOptions): Promise<unknown>;
  put(url: string, data?: unknown, options?: RequestOptions): Promise<unknown>;
  delete(url: string, options?: RequestOptions): Promise<unknown>;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

export interface PluginStorage {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}

export type PluginHookHandler = (context: PluginExecutionContext) => Promise<void>;

export interface PluginUpdateInfo {
  currentVersion: string;
  availableVersion: string;
  releaseNotes?: string;
  breaking?: boolean;
  releaseDate?: Date;
}
