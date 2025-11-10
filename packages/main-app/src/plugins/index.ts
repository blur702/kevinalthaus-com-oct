import type express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { pluginManager } from './manager';
import { createLogger } from '@monorepo/shared';

const logger = createLogger({ context: 'PluginDiscovery' });

export async function discoverPlugins(app: express.Express): Promise<void> {
  const pluginsDir = path.resolve(__dirname, '../../../../plugins');
  try {
    const pluginDirs = await fs.readdir(pluginsDir, { withFileTypes: true });
    for (const dirent of pluginDirs) {
      if (dirent.isDirectory()) {
        const pluginDir = path.join(pluginsDir, dirent.name);
        const packageJsonPath = path.join(pluginDir, 'package.json');
        try {
          const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const packageJson = JSON.parse(packageJsonContent);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          const mainFile = packageJson.main || 'index.js';
          const mainFilePath = path.join(pluginDir, String(mainFile));

          // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
          const plugin = require(mainFilePath);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (plugin.register) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            await plugin.register(app);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            pluginManager.registerPlugin(String(packageJson.name), plugin);
          }
        } catch (error) {
          logger.error(`Failed to load plugin ${dirent.name}:`, error instanceof Error ? error : undefined);
        }
      }
    }
  } catch (error) {
    logger.error('Failed to discover plugins:', error instanceof Error ? error : undefined);
  }
}

