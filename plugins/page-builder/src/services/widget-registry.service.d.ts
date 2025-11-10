/**
 * Widget Registry Service
 * Auto-discovers and manages widget metadata from the widgets/ directory
 */
import type { PluginLogger } from '@monorepo/shared/plugin/lifecycle';
import { WidgetRegistryEntry, WidgetInstance, WidgetConfig } from '../types';
export declare class WidgetRegistryService {
    private registry;
    private schemaCache;
    private pluginPath;
    private logger;
    constructor(pluginPath: string, logger: PluginLogger);
    /**
     * Discover and load all widgets from the widgets/ directory
     */
    discoverWidgets(): Promise<void>;
    /**
     * Validate and load a single widget
     */
    validateAndLoadWidget(widgetName: string): Promise<WidgetRegistryEntry | null>;
    /**
     * Get all registered widgets
     */
    getRegistry(): WidgetRegistryEntry[];
    /**
     * Get widget by type
     */
    getWidgetByType(type: string): WidgetRegistryEntry | null;
    /**
     * Get widgets by category
     */
    getWidgetsByCategory(category: string): WidgetRegistryEntry[];
    /**
     * Get unique list of categories
     */
    getCategories(): string[];
    /**
     * Check if widget type exists and is valid
     */
    isWidgetAvailable(type: string): boolean;
    /**
     * Get placeholder widget for missing/invalid widgets
     */
    getPlaceholderWidget(): WidgetRegistryEntry;
    /**
     * Resolve widget for rendering with graceful degradation
     */
    resolveWidgetForRendering(widgetInstance: WidgetInstance): WidgetRegistryEntry;
    /**
     * Validate widget configuration against its schema
     */
    validateWidgetConfig(widgetType: string, config: WidgetConfig): Promise<{
        valid: boolean;
        errors?: string[];
    }>;
    /**
     * Get widget's Joi schema by dynamically importing config.ts
     */
    getWidgetSchema(widgetType: string): Promise<any>;
    /**
     * Refresh widget registry (useful for development/hot-reload)
     */
    refresh(): Promise<void>;
}
//# sourceMappingURL=widget-registry.service.d.ts.map