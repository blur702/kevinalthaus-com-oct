

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

export interface ResourceQuotas {
  maxConnections: number;
  maxStorageBytes: number;
  maxTablesPerPlugin: number;
  maxRowsPerTable: number;
  maxIndexesPerTable: number;
  maxQueryComplexity: number;
  maxQueryRows: number;
  maxExecutionTime: number;
}

export class DatabaseIsolationEnforcer {
  // Pre-compiled regex patterns for better performance
  private static readonly complexityPatterns = {
    join: /\bjoin\b/gi,
    subquery: /\(select\b/gi,
    aggregate: /\b(count|sum|avg|min|max|group\s+by)\b/gi,
    wildcard: /\*\s*from/gi,
    window: /\bover\s*\(/gi,
    cte: /\bwith\b/gi,
  };

  constructor(
    private readonly quotas: ResourceQuotas,
  ) {}

  enforceQuotas(
    query: string,
    estimatedRows: number = 1000,
  ): void {
    const complexity = this.estimateQueryComplexity(query);
    
    if (complexity > this.quotas.maxQueryComplexity) {
      throw new Error(
        `Query complexity ${complexity} exceeds limit ${this.quotas.maxQueryComplexity}`,
      );
    }

    if (estimatedRows > this.quotas.maxQueryRows) {
      throw new Error(
        `Estimated rows ${estimatedRows} exceeds limit ${this.quotas.maxQueryRows}`,
      );
    }
  }

  private estimateQueryComplexity(query: string): number {
    let complexity = 1;

    // Multiple pattern matches to assess query complexity
    // This is not a single-pass algorithm but provides accurate complexity estimation
    const lowerQuery = query.toLowerCase();

    // Count joins - each join increases complexity as it multiplies row processing
    complexity += (lowerQuery.match(DatabaseIsolationEnforcer.complexityPatterns.join) || []).length * 10;

    // Count subqueries - nested queries have higher cost due to repeated scans
    complexity += (lowerQuery.match(DatabaseIsolationEnforcer.complexityPatterns.subquery) || []).length * 20;

    // Count aggregates - require full table scans and grouping operations
    complexity += (lowerQuery.match(DatabaseIsolationEnforcer.complexityPatterns.aggregate) || []).length * 5;

    // Count wildcards - selecting all columns increases I/O and memory usage
    complexity += (lowerQuery.match(DatabaseIsolationEnforcer.complexityPatterns.wildcard) || []).length * 3;

    // Count window functions - require sorting and partitioning operations
    complexity += (lowerQuery.match(DatabaseIsolationEnforcer.complexityPatterns.window) || []).length * 15;

    // Count CTEs - Common Table Expressions add temporary result set overhead
    complexity += (lowerQuery.match(DatabaseIsolationEnforcer.complexityPatterns.cte) || []).length * 8;

    // Cap at configured maximum to prevent integer overflow
    return Math.min(complexity, this.quotas.maxQueryComplexity);
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
  quota: ResourceQuota
): ResourceQuotaEnforcer {
  return new ResourceQuotaEnforcer(quota);
}

export class ResourceQuotaEnforcer {
  constructor(
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
