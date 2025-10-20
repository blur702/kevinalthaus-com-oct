import { PluginManifest } from './manifest';
import { PluginStatus } from '../constants';

export interface PluginLifecycleContext {
  pluginId: string;
  manifest: PluginManifest;
  pluginPath: string;
  dataPath: string;
  config?: Record<string, unknown>;
}

export interface PluginLifecycleHooks {
  onInstall?(context: PluginLifecycleContext): Promise<void>;
  onActivate?(context: PluginLifecycleContext): Promise<void>;
  onDeactivate?(context: PluginLifecycleContext): Promise<void>;
  onUninstall?(context: PluginLifecycleContext): Promise<void>;
  onUpdate?(context: PluginLifecycleContext, oldVersion: string): Promise<void>;
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

export interface PluginExecutionContext extends PluginLifecycleContext {
  logger: PluginLogger;
  api: PluginAPI;
  storage: PluginStorage;
}

export interface PluginLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;
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
