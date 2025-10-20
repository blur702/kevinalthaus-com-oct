import { PluginDatabaseConfig, IsolationLevel } from './plugin-database';

export interface IsolationPolicy {
  allowCrossPluginQueries: boolean;
  allowSystemSchemaAccess: boolean;
  maxQueryComplexity: number;
  maxExecutionTime: number;
  allowedOperations: DatabaseOperation[];
}

export enum DatabaseOperation {
  SELECT = 'SELECT',
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  CREATE_TABLE = 'CREATE_TABLE',
  ALTER_TABLE = 'ALTER_TABLE',
  DROP_TABLE = 'DROP_TABLE',
  CREATE_INDEX = 'CREATE_INDEX',
  DROP_INDEX = 'DROP_INDEX',
  TRUNCATE = 'TRUNCATE',
}

export const DEFAULT_ISOLATION_POLICY: IsolationPolicy = {
  allowCrossPluginQueries: false,
  allowSystemSchemaAccess: false,
  maxQueryComplexity: 1000,
  maxExecutionTime: 30000,
  allowedOperations: [
    DatabaseOperation.SELECT,
    DatabaseOperation.INSERT,
    DatabaseOperation.UPDATE,
    DatabaseOperation.DELETE,
  ],
};

export const ADMIN_ISOLATION_POLICY: IsolationPolicy = {
  allowCrossPluginQueries: true,
  allowSystemSchemaAccess: false,
  maxQueryComplexity: 10000,
  maxExecutionTime: 60000,
  allowedOperations: Object.values(DatabaseOperation),
};

export class IsolationEnforcer {
  constructor(private readonly policy: IsolationPolicy) {}

  validateQuery(query: string, pluginId: string): QueryValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const operation = this.extractOperation(query);
    if (operation && !this.policy.allowedOperations.includes(operation)) {
      errors.push(`Operation ${operation} is not allowed by isolation policy`);
    }

    if (!this.policy.allowCrossPluginQueries) {
      const schemas = this.extractSchemaReferences(query);
      const pluginSchema = `plugin_${pluginId}`;

      for (const schema of schemas) {
        if (schema !== pluginSchema && schema.startsWith('plugin_')) {
          errors.push(`Cross-plugin query to schema ${schema} is not allowed`);
        }
      }
    }

    if (!this.policy.allowSystemSchemaAccess) {
      const systemSchemas = ['information_schema', 'pg_catalog', 'pg_toast'];
      const schemas = this.extractSchemaReferences(query);

      for (const schema of schemas) {
        if (systemSchemas.includes(schema.toLowerCase())) {
          errors.push(`Access to system schema ${schema} is not allowed`);
        }
      }
    }

    const complexity = this.estimateQueryComplexity(query);
    if (complexity > this.policy.maxQueryComplexity) {
      errors.push(`Query complexity ${complexity} exceeds maximum ${this.policy.maxQueryComplexity}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      complexity,
    };
  }

  getIsolationLevel(config: PluginDatabaseConfig): IsolationLevel {
    if (config.readOnly) {
      return IsolationLevel.READ_COMMITTED;
    }

    return config.isolationLevel || IsolationLevel.READ_COMMITTED;
  }

  private extractOperation(query: string): DatabaseOperation | null {
    const normalized = query.trim().toUpperCase();

    for (const op of Object.values(DatabaseOperation)) {
      if (normalized.startsWith(op)) {
        return op;
      }
    }

    return null;
  }

  private extractSchemaReferences(query: string): string[] {
    const schemaPattern = /(?:from|join|into|update|table)\s+(?:([a-z_][a-z0-9_]*)\.)?\s*[a-z_][a-z0-9_]*/gi;
    const schemas = new Set<string>();
    let match;

    while ((match = schemaPattern.exec(query)) !== null) {
      if (match[1]) {
        schemas.add(match[1]);
      }
    }

    return Array.from(schemas);
  }

  private estimateQueryComplexity(query: string): number {
    let complexity = 1;

    const joinCount = (query.match(/\bjoin\b/gi) || []).length;
    complexity += joinCount * 10;

    const subqueryCount = (query.match(/\(select\b/gi) || []).length;
    complexity += subqueryCount * 20;

    const aggregateCount = (query.match(/\b(count|sum|avg|min|max|group\s+by)\b/gi) || []).length;
    complexity += aggregateCount * 5;

    const wildcardCount = (query.match(/\*\s*from/gi) || []).length;
    complexity += wildcardCount * 3;

    return complexity;
  }
}

export interface QueryValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  complexity: number;
}

export interface ResourceQuota {
  maxConnections: number;
  maxStorageBytes: number;
  maxTablesPerPlugin: number;
  maxRowsPerTable: number;
  maxIndexesPerTable: number;
}

export const DEFAULT_RESOURCE_QUOTA: ResourceQuota = {
  maxConnections: 5,
  maxStorageBytes: 100 * 1024 * 1024,
  maxTablesPerPlugin: 20,
  maxRowsPerTable: 100000,
  maxIndexesPerTable: 10,
};

export function enforceResourceQuota(
  pluginId: string,
  quota: ResourceQuota
): ResourceQuotaEnforcer {
  return new ResourceQuotaEnforcer(pluginId, quota);
}

export class ResourceQuotaEnforcer {
  constructor(
    private readonly pluginId: string,
    private readonly quota: ResourceQuota
  ) {}

  checkConnectionLimit(currentConnections: number): boolean {
    return currentConnections < this.quota.maxConnections;
  }

  checkStorageLimit(currentStorageBytes: number): boolean {
    return currentStorageBytes < this.quota.maxStorageBytes;
  }

  checkTableLimit(currentTableCount: number): boolean {
    return currentTableCount < this.quota.maxTablesPerPlugin;
  }

  checkRowLimit(tableRowCount: number): boolean {
    return tableRowCount < this.quota.maxRowsPerTable;
  }

  checkIndexLimit(tableIndexCount: number): boolean {
    return tableIndexCount < this.quota.maxIndexesPerTable;
  }
}
