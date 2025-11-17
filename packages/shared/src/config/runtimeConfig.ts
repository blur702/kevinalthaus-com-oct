import fs from 'fs';
import path from 'path';
import type { AppConfig } from '../types';

export type RuntimeConfig = AppConfig & {
  getSecret?: (key: string, required?: boolean) => string | undefined;
};

let cachedConfig: RuntimeConfig | null = null;

function findWorkspaceRoot(startDir: string): string {
  let currentDir = startDir;

  while (true) {
    const pkgPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { workspaces?: unknown };
        if (pkg.workspaces) {
          return currentDir;
        }
      } catch {
        // ignore JSON parse errors and continue walking up
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error('Unable to locate workspace root while loading configuration');
    }
    currentDir = parentDir;
  }
}

function loadWorkspaceConfig(): RuntimeConfig {
  const workspaceRoot = findWorkspaceRoot(__dirname);
  const configModulePath = path.join(workspaceRoot, 'config');

  let requiredModule: unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    requiredModule = require(configModulePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load workspace configuration from ${configModulePath}: ${message}`);
  }

  if (!requiredModule || (typeof requiredModule !== 'object' && typeof requiredModule !== 'function')) {
    throw new Error(`Workspace configuration module at ${configModulePath} did not return an object.`);
  }

  const exportedConfig = (requiredModule as { config?: RuntimeConfig }).config;
  if (!exportedConfig) {
    throw new Error(
      `Workspace configuration module at ${configModulePath} does not export a "config" object.`
    );
  }

  return exportedConfig;
}

function ensureRuntimeConfig(): RuntimeConfig {
  if (!cachedConfig) {
    cachedConfig = loadWorkspaceConfig();
  }
  return cachedConfig;
}

export function loadRuntimeConfig(): RuntimeConfig {
  return ensureRuntimeConfig();
}

export function getRuntimeConfig(): RuntimeConfig {
  return ensureRuntimeConfig();
}

const configProxy = new Proxy<RuntimeConfig>(
  {} as RuntimeConfig,
  {
    get(_target, prop: string | symbol) {
      const resolved = ensureRuntimeConfig() as unknown as Record<PropertyKey, unknown>;
      return Reflect.get(resolved, prop);
    },
    ownKeys() {
      return Reflect.ownKeys(ensureRuntimeConfig());
    },
    getOwnPropertyDescriptor(_target, prop: string | symbol) {
      const descriptor = Object.getOwnPropertyDescriptor(
        ensureRuntimeConfig(),
        prop as keyof AppConfig
      );
      if (descriptor) {
        return {
          ...descriptor,
          configurable: false,
        };
      }
      return undefined;
    },
  }
) as RuntimeConfig;

export const config = configProxy;
