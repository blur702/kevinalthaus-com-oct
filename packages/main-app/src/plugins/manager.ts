import type express from 'express';

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
}

// Minimal in-memory manager to satisfy imports and avoid crashes
class PluginManager {
  private discovered: DiscoveredPlugin[] = [];
  private registry: RegistryEntry[] = [];

  init(_app: express.Express): void {
    // No-op implementation - app reference not needed for basic functionality
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
    }
    return Promise.resolve();
  }

  activate(id: string): Promise<void> {
    const entry = this.registry.find((r) => r.id === id);
    if (entry) {
      entry.status = 'active';
    }
    return Promise.resolve();
  }

  deactivate(id: string): Promise<void> {
    const entry = this.registry.find((r) => r.id === id);
    if (entry) {
      entry.status = 'inactive';
    }
    return Promise.resolve();
  }

  uninstall(id: string): Promise<void> {
    this.registry = this.registry.filter((r) => r.id !== id);
    return Promise.resolve();
  }
}

export const pluginManager = new PluginManager();

