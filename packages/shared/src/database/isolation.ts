

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

/**
 * Query execution constraints enforced during static query analysis
 */
export interface QueryExecutionLimits {
  maxQueryComplexity: number;
  maxQueryRows: number;
  // Note: maxExecutionTime must be enforced at query execution time using
  // database timeout mechanisms (e.g., PostgreSQL's statement_timeout).
  // It cannot be enforced during static query analysis in enforceQuotas().
  maxExecutionTime: number;
}

/**
 * Infrastructure-level resource limits for plugins
 * These are enforced at the infrastructure level, not during query analysis
 */
export interface InfraResourceLimits {
  maxConnections: number;
  maxStorageBytes: number;
  maxTablesPerPlugin: number;
  maxRowsPerTable: number;
  maxIndexesPerTable: number;
}

/**
 * @deprecated Use QueryExecutionLimits for query constraints or InfraResourceLimits for infrastructure constraints
 */
export interface QueryResourceLimits extends QueryExecutionLimits, InfraResourceLimits {}

/** @deprecated Use QueryExecutionLimits instead */
export type ResourceQuotas = QueryResourceLimits;

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

  private readonly maxQueryComplexity: number;
  private readonly maxQueryRows: number;

  constructor(limits: QueryExecutionLimits) {
    this.maxQueryComplexity = limits.maxQueryComplexity;
    this.maxQueryRows = limits.maxQueryRows;
  }

  // Note: This method does NOT enforce maxExecutionTime from QueryExecutionLimits.
  // Execution time limits must be applied at query execution time using database
  // timeout mechanisms (e.g., PostgreSQL's statement_timeout or query cancellation).
  enforceQuotas(
    query: string,
    estimatedRows: number = 1000,
  ): void {
    // Input validation
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      throw new Error('Query parameter cannot be empty or whitespace');
    }

    if (!Number.isFinite(estimatedRows) || estimatedRows <= 0) {
      throw new Error('Estimated rows must be a finite positive number greater than zero');
    }

    const complexity = this.estimateQueryComplexity(trimmedQuery);

    if (complexity > this.maxQueryComplexity) {
      throw new Error(
        `Query complexity ${complexity} exceeds limit ${this.maxQueryComplexity}`,
      );
    }

    if (estimatedRows > this.maxQueryRows) {
      throw new Error(
        `Estimated rows ${estimatedRows} exceeds limit ${this.maxQueryRows}`,
      );
    }
  }

  // TODO: The current regex-based approach has significant limitations:
  // - Cannot distinguish SQL keywords within strings or comments (e.g., 'JOIN' in WHERE clause string)
  // - Misses cartesian products (missing ON clause in JOINs)
  // - Does not detect UNION/INTERSECT/EXCEPT operations
  // - Cannot identify recursive CTEs which are much more expensive
  // - Does not assess WHERE clause complexity (e.g., function calls, type conversions)
  // - Misses OR chains that prevent index usage
  // For production use, replace with a proper SQL parser like node-sql-parser or pgsql-parser
  // to perform accurate AST-based complexity analysis.
  private estimateQueryComplexity(query: string): number {
    let complexity = 1;

    // Multiple pattern matches to assess query complexity
    // Note: Regex patterns already have case-insensitive flags (/i or /gi)

    // Count joins - each join increases complexity as it multiplies row processing
    complexity += (query.match(DatabaseIsolationEnforcer.complexityPatterns.join) || []).length * 10;

    // Count subqueries - nested queries have higher cost due to repeated scans
    complexity += (query.match(DatabaseIsolationEnforcer.complexityPatterns.subquery) || []).length * 20;

    // Count aggregates - require full table scans and grouping operations
    complexity += (query.match(DatabaseIsolationEnforcer.complexityPatterns.aggregate) || []).length * 5;

    // Count wildcards - selecting all columns increases I/O and memory usage
    complexity += (query.match(DatabaseIsolationEnforcer.complexityPatterns.wildcard) || []).length * 3;

    // Count window functions - require sorting and partitioning operations
    complexity += (query.match(DatabaseIsolationEnforcer.complexityPatterns.window) || []).length * 15;

    // Count CTEs - Common Table Expressions add temporary result set overhead
    complexity += (query.match(DatabaseIsolationEnforcer.complexityPatterns.cte) || []).length * 8;

    // Cap at Number.MAX_SAFE_INTEGER to prevent overflow
    // Return actual complexity so enforceQuotas can properly detect quota violations
    return Math.min(complexity, Number.MAX_SAFE_INTEGER);
  }
}

export interface QueryValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  complexity: number;
}

/** @deprecated Use InfraResourceLimits instead */
export type ResourceQuota = InfraResourceLimits;

export const DEFAULT_RESOURCE_QUOTA: InfraResourceLimits = {
  maxConnections: 5,
  maxStorageBytes: 100 * 1024 * 1024,
  maxTablesPerPlugin: 20,
  maxRowsPerTable: 100000,
  maxIndexesPerTable: 10,
};

export function enforceResourceQuota(
  quota: InfraResourceLimits
): ResourceQuotaEnforcer {
  return new ResourceQuotaEnforcer(quota);
}

export class ResourceQuotaEnforcer {
  constructor(
    private readonly quota: InfraResourceLimits
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
