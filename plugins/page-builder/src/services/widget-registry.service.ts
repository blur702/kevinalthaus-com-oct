/**
 * Widget Registry Service
 * Auto-discovers and manages widget metadata from the widgets/ directory
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { PluginLogger } from '@monorepo/shared/plugin/lifecycle';
import {
  WidgetManifest,
  WidgetRegistryEntry,
  validateWidgetManifest,
  WidgetInstance,
  WidgetConfig
} from '../types';

export class WidgetRegistryService {
  private registry: Map<string, WidgetRegistryEntry> = new Map();
  private schemaCache: Map<string, any> = new Map();
  private pluginPath: string;
  private logger: PluginLogger;

  constructor(pluginPath: string, logger: PluginLogger) {
    this.pluginPath = pluginPath;
    this.logger = logger;
  }

  /**
   * Discover and load all widgets from the widgets/ directory
   */
  async discoverWidgets(): Promise<void> {
    const widgetsDir = path.join(this.pluginPath, 'widgets');

    try {
      this.logger.info('Starting widget discovery', { widgetsDir });

      // Read widgets directory
      const entries = await fs.readdir(widgetsDir, { withFileTypes: true });

      // Filter directories (exclude README.md and other files)
      const widgetDirs = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);

      if (widgetDirs.length === 0) {
        this.logger.info('No widget directories found');
        return;
      }

      // Load each widget
      let validCount = 0;
      let invalidCount = 0;

      for (const widgetName of widgetDirs) {
        const entry = await this.validateAndLoadWidget(widgetName);
        if (entry && entry.isValid) {
          this.registry.set(entry.type, entry);
          validCount++;
        } else {
          invalidCount++;
        }
      }

      this.logger.info('Widget discovery completed', {
        total: widgetDirs.length,
        valid: validCount,
        invalid: invalidCount
      });
    } catch (error) {
      // Don't throw - log and continue with empty registry
      this.logger.error('Widget discovery failed', error as Error);
    }
  }

  /**
   * Validate and load a single widget
   */
  async validateAndLoadWidget(widgetName: string): Promise<WidgetRegistryEntry | null> {
    const widgetPath = path.join(this.pluginPath, 'widgets', widgetName);
    const validationErrors: string[] = [];

    try {
      // Check required files
      const requiredFiles = ['widget.json', 'component.tsx', 'config.ts', 'types.ts'];
      for (const file of requiredFiles) {
        const filePath = path.join(widgetPath, file);
        try {
          await fs.access(filePath);
        } catch {
          validationErrors.push(`Missing required file: ${file}`);
        }
      }

      // If any required files are missing, create invalid entry
      if (validationErrors.length > 0) {
        this.logger.warn(`Widget '${widgetName}' is missing required files`, {
          widgetName,
          errors: validationErrors
        });
        return null;
      }

      // Read and parse widget.json
      const manifestPath = path.join(widgetPath, 'widget.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifestData = JSON.parse(manifestContent);

      // Validate manifest
      let manifest: WidgetManifest;
      try {
        manifest = validateWidgetManifest(manifestData);
      } catch (error) {
        validationErrors.push(`Invalid manifest: ${error instanceof Error ? error.message : String(error)}`);

        // Create invalid entry with partial data
        const entry: WidgetRegistryEntry = {
          ...manifestData,
          type: manifestData.type || widgetName,
          componentPath: path.join('widgets', widgetName, 'component.tsx'),
          configSchemaPath: path.join('widgets', widgetName, 'config.ts'),
          typesPath: path.join('widgets', widgetName, 'types.ts'),
          isValid: false,
          validationErrors,
          loadedAt: new Date()
        };

        this.logger.warn(`Widget '${widgetName}' has invalid manifest`, {
          widgetName,
          errors: validationErrors
        });

        return entry;
      }

      // Create valid entry
      const entry: WidgetRegistryEntry = {
        ...manifest,
        componentPath: path.join('widgets', widgetName, 'component.tsx'),
        configSchemaPath: path.join('widgets', widgetName, 'config.ts'),
        typesPath: path.join('widgets', widgetName, 'types.ts'),
        isValid: true,
        validationErrors: [],
        loadedAt: new Date()
      };

      this.logger.debug(`Successfully loaded widget '${manifest.type}'`, {
        type: manifest.type,
        category: manifest.category,
        version: manifest.version
      });

      return entry;
    } catch (error) {
      this.logger.error(`Failed to load widget '${widgetName}'`, error as Error);
      return null;
    }
  }

  /**
   * Get all registered widgets
   */
  getRegistry(): WidgetRegistryEntry[] {
    return Array.from(this.registry.values());
  }

  /**
   * Get widget by type
   */
  getWidgetByType(type: string): WidgetRegistryEntry | null {
    return this.registry.get(type) || null;
  }

  /**
   * Get widgets by category
   */
  getWidgetsByCategory(category: string): WidgetRegistryEntry[] {
    return this.getRegistry().filter(widget => widget.category === category);
  }

  /**
   * Get unique list of categories
   */
  getCategories(): string[] {
    const categories = new Set<string>();
    for (const widget of this.registry.values()) {
      if (widget.isValid) {
        categories.add(widget.category);
      }
    }
    return Array.from(categories).sort();
  }

  /**
   * Check if widget type exists and is valid
   */
  isWidgetAvailable(type: string): boolean {
    const widget = this.registry.get(type);
    return widget !== undefined && widget.isValid;
  }

  /**
   * Get placeholder widget for missing/invalid widgets
   */
  getPlaceholderWidget(): WidgetRegistryEntry {
    return {
      type: 'placeholder',
      name: 'Placeholder',
      displayName: 'Missing Widget',
      description: 'This widget is no longer available or failed to load',
      category: 'general',
      icon: 'block',
      version: '1.0.0',
      author: {
        name: 'System',
        email: 'system@kevinalthaus.com'
      },
      configSchema: 'config.ts',
      tags: ['placeholder', 'fallback'],
      isContainer: false,
      deprecated: true,
      componentPath: '',
      configSchemaPath: '',
      typesPath: '',
      isValid: true,
      validationErrors: [],
      loadedAt: new Date()
    };
  }

  /**
   * Resolve widget for rendering with graceful degradation
   */
  resolveWidgetForRendering(widgetInstance: WidgetInstance): WidgetRegistryEntry {
    const widget = this.getWidgetByType(widgetInstance.type);

    if (widget && widget.isValid) {
      return widget;
    }

    // Widget not found or invalid - log warning and return placeholder
    this.logger.warn('Widget not available for rendering, using placeholder', {
      widgetType: widgetInstance.type,
      widgetId: widgetInstance.id
    });

    return this.getPlaceholderWidget();
  }

  /**
   * Validate widget configuration against its schema
   */
  async validateWidgetConfig(
    widgetType: string,
    config: WidgetConfig
  ): Promise<{ valid: boolean; errors?: string[] }> {
    try {
      const schema = await this.getWidgetSchema(widgetType);

      if (!schema) {
        return {
          valid: false,
          errors: [`Schema not found for widget type: ${widgetType}`]
        };
      }

      const { error } = schema.validate(config, {
        abortEarly: false,
        stripUnknown: false
      });

      if (error) {
        return {
          valid: false,
          errors: error.details.map((detail: any) => detail.message)
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation failed: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  /**
   * Get widget's Joi schema by dynamically importing config.ts
   */
  async getWidgetSchema(widgetType: string): Promise<any> {
    // Check cache first
    if (this.schemaCache.has(widgetType)) {
      return this.schemaCache.get(widgetType);
    }

    const widget = this.getWidgetByType(widgetType);
    if (!widget || !widget.isValid) {
      this.logger.warn(`Cannot load schema for invalid widget: ${widgetType}`);
      return null;
    }

    try {
      // Dynamic import of config.ts with path validation to avoid directory traversal
      const widgetsBaseDir = path.join(this.pluginPath, 'widgets');
      const resolvedConfigPath = path.resolve(this.pluginPath, widget.configSchemaPath);
      const normalizedBase = path.resolve(widgetsBaseDir) + path.sep;
      const normalizedResolved = path.resolve(resolvedConfigPath) + '';

      if (!normalizedResolved.startsWith(normalizedBase)) {
        this.logger.error(
          `Rejected schema path outside widgets directory for widget: ${widgetType}`,
          new Error(`Invalid schema path: ${resolvedConfigPath}`)
        );
        return null;
      }

      const configModule = await import(resolvedConfigPath);

      // Look for common schema export names
      const schema = configModule.default ||
                     configModule[`${widgetType}ConfigSchema`] ||
                     configModule.configSchema ||
                     configModule.schema;

      if (!schema) {
        this.logger.error(
          `No schema export found in config.ts for widget: ${widgetType}`,
          new Error(`Schema not found in ${resolvedConfigPath}`)
        );
        return null;
      }

      // Cache the schema
      this.schemaCache.set(widgetType, schema);

      return schema;
    } catch (error) {
      this.logger.error(`Failed to load schema for widget: ${widgetType}`, error as Error);

      return null;
    }
  }

  /**
   * Refresh widget registry (useful for development/hot-reload)
   */
  async refresh(): Promise<void> {
    this.registry.clear();
    this.schemaCache.clear();
    await this.discoverWidgets();
  }
}
