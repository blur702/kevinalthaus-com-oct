/**
 * Page Builder API Routes
 */
import { Router, Request } from 'express';
import { Pool } from 'pg';
import { WidgetRegistryService } from '../services/widget-registry.service';
import { PluginLogger } from '@monorepo/shared/plugin/lifecycle';
export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        capabilities: string[];
    };
}
export declare function createPageBuilderRouter(pool: Pool, logger: PluginLogger, widgetRegistry: WidgetRegistryService): Router;
//# sourceMappingURL=index.d.ts.map