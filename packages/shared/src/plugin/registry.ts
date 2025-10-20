import { PluginManifest } from './manifest';
import { PluginInstance } from './lifecycle';

export interface PluginRegistryEntry {
  id: string;
  manifest: PluginManifest;
  instance: PluginInstance;
  checksum: string;
  signature?: string;
}

export interface PluginRegistry {
  register(entry: PluginRegistryEntry): Promise<void>;
  unregister(pluginId: string): Promise<void>;
  get(pluginId: string): Promise<PluginRegistryEntry | null>;
  getAll(): Promise<PluginRegistryEntry[]>;
  getByStatus(status: string): Promise<PluginRegistryEntry[]>;
  update(pluginId: string, updates: Partial<PluginRegistryEntry>): Promise<void>;
  exists(pluginId: string): Promise<boolean>;
}

export interface PluginSearchCriteria {
  name?: string;
  author?: string;
  keywords?: string[];
  capabilities?: string[];
  status?: string;
  limit?: number;
  offset?: number;
}

export interface PluginSearchResult {
  entries: PluginRegistryEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface PluginDependencyGraph {
  [pluginId: string]: string[];
}

export interface PluginConflict {
  pluginId: string;
  conflictingPluginId: string;
  reason: string;
}

export interface PluginValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PluginMetadata {
  downloadCount?: number;
  rating?: number;
  reviewCount?: number;
  lastUpdated?: Date;
  verified?: boolean;
  tags?: string[];
}
