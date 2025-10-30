import { Parser } from 'node-sql-parser';

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

export interface ComplexityWeights {
  join: number;
  cartesianJoin: number;
  subquery: number;
  union: number;
  intersect: number;
  except: number;
  recursiveCte: number;
  aggregate: number;
  window: number;
  wildcard: number;
  whereOr: number;
  whereFunction: number;
}

const DEFAULT_COMPLEXITY_WEIGHTS: ComplexityWeights = {
  join: 10,
  cartesianJoin: 25,
  subquery: 20,
  union: 15,
  intersect: 20,
  except: 20,
  recursiveCte: 30,
  aggregate: 5,
  window: 15,
  wildcard: 3,
  whereOr: 2,
  whereFunction: 2,
};

export interface MinimalLogger {
  info: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
}

export interface IsolationEnforcerOptions {
  limits: QueryExecutionLimits;
  weights?: Partial<ComplexityWeights>;
  fallbackComplexity?: number;
  logger?: MinimalLogger;
}

export class DatabaseIsolationEnforcer {
  private readonly maxQueryComplexity: number;
  private readonly maxQueryRows: number;
  private readonly weights: ComplexityWeights;
  private readonly logger: MinimalLogger;
  private readonly parseFailureThreshold: number;
  private readonly parseFailureCounts: Map<string, number>;

  constructor(limits: QueryExecutionLimits, weights?: Partial<ComplexityWeights>);
  constructor(options: IsolationEnforcerOptions);
  constructor(
    limitsOrOptions: QueryExecutionLimits | IsolationEnforcerOptions,
    weights: Partial<ComplexityWeights> = {}
  ) {
    // Support both legacy and new constructor signatures
    const options: IsolationEnforcerOptions =
      'limits' in limitsOrOptions ? limitsOrOptions : { limits: limitsOrOptions, weights };

    // Validate limits and normalize
    const mc = options.limits.maxQueryComplexity;
    const mr = options.limits.maxQueryRows;
    if (!Number.isFinite(mc) || Math.floor(mc) < 1) {
      throw new Error(`[Isolation] Invalid maxQueryComplexity: ${mc}`);
    }
    if (!Number.isFinite(mr) || Math.floor(mr) < 1) {
      throw new Error(`[Isolation] Invalid maxQueryRows: ${mr}`);
    }

    this.maxQueryComplexity = Math.floor(mc);
    this.maxQueryRows = Math.floor(mr);
    this.weights = { ...DEFAULT_COMPLEXITY_WEIGHTS, ...(options.weights || {}) };
    this.logger = options.logger || {
      info: (message, context) => {
        // eslint-disable-next-line no-console
        console.log(message, context);
      },
      error: (message, context) => {
        // eslint-disable-next-line no-console
        console.error(message, context);
      },
      warn: (message, context) => {
        // eslint-disable-next-line no-console
        console.warn(message, context);
      },
    };
    this.parseFailureThreshold = Math.max(1, Math.floor((options as { parseFailureThreshold?: number }).parseFailureThreshold ?? 3));
    this.parseFailureCounts = new Map<string, number>();
  }

  /**
   * Enforce query quotas based on complexity and estimated row count.
   *
   * Note: This method does NOT enforce maxExecutionTime from QueryExecutionLimits.
   * Execution time limits must be applied at query execution time using database
   * timeout mechanisms (e.g., PostgreSQL's statement_timeout or query cancellation).
   *
   * TRUST ASSUMPTION: The estimatedRows parameter cannot be fully trusted as it comes
   * from callers who may provide inaccurate estimates. Callers MUST prefer database
   * planner estimates (e.g., from EXPLAIN) or provide planner-derived estimates via
   * the explainEstimate parameter.
   *
   * @param query - SQL query to validate
   * @param estimatedRows - Caller-provided row estimate (untrusted)
   * @param options - Optional validation options
   * @param options.explainEstimate - Planner-derived estimate from EXPLAIN (trusted)
   * @param options.requireExplain - If true, throw error when explainEstimate not provided
   * @param options.suspiciousRowThreshold - Log warning if estimatedRows below this (default: 1000)
   * @throws Error if quotas are exceeded or requireExplain is true without explainEstimate
   */
  enforceQuotas(
    query: string,
    estimatedRows: number,
    options?: {
      explainEstimate?: number;
      requireExplain?: boolean;
      suspiciousRowThreshold?: number;
    }
  ): void {
    // Input validation
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      throw new Error('Query parameter cannot be empty or whitespace');
    }

    if (!Number.isFinite(estimatedRows) || estimatedRows <= 0) {
      throw new Error('Estimated rows must be a finite positive number');
    }

    // Require EXPLAIN-derived estimate if configured
    if (options?.requireExplain && !options.explainEstimate) {
      throw new Error(
        'requireExplain is true but no explainEstimate provided. ' +
        'Use EXPLAIN to get planner estimate before calling enforceQuotas.'
      );
    }

    // Use EXPLAIN estimate if provided (trusted), otherwise use caller estimate (untrusted)
    const effectiveEstimate = options?.explainEstimate ?? estimatedRows;

    // Detect suspiciously low estimates for complex queries
    const suspiciousThreshold = options?.suspiciousRowThreshold ?? 1000;
    const isComplexQuery = /\b(JOIN|UNION|GROUP BY|DISTINCT)\b/i.test(trimmedQuery) ||
      (trimmedQuery.includes('*') && !/\bWHERE\b/i.test(trimmedQuery));

    if (estimatedRows < suspiciousThreshold && isComplexQuery) {
      this.logger.warn(
        `[QueryValidator] Suspiciously low estimate for complex query:\n` +
        `  Provided estimate: ${estimatedRows} rows\n` +
        `  Threshold: ${suspiciousThreshold} rows\n` +
        `  Query: ${trimmedQuery.substring(0, 200)}${trimmedQuery.length > 200 ? '...' : ''}\n` +
        `  Recommendation: Use EXPLAIN to get accurate planner estimate`,
        { estimatedRows, suspiciousThreshold, queryPreview: trimmedQuery.substring(0, 200) }
      );
    }

    const complexity = this.estimateQueryComplexity(trimmedQuery);

    // Use >= for exclusive limits (values >= max are rejected, max is not allowed)
    if (complexity >= this.maxQueryComplexity) {
      throw new Error(`Query complexity ${complexity} is greater than or equal to the configured limit ${this.maxQueryComplexity}; values >= ${this.maxQueryComplexity} are rejected and the limit value itself is not allowed`);
    }

    if (effectiveEstimate >= this.maxQueryRows) {
      throw new Error(`Estimated rows ${effectiveEstimate} is greater than or equal to the configured limit ${this.maxQueryRows}; values >= ${this.maxQueryRows} are rejected and the limit value itself is not allowed`);
    }
  }

  // AST-based complexity analysis using node-sql-parser to avoid string/comment false-positives
  private estimateQueryComplexity(query: string): number {
    try {
      const parser = new Parser();
      const ast = parser.astify(query, { database: 'PostgreSQL' });

      // Runtime type guard for AST - parser can return array or single node
      let statements: unknown[];
      if (Array.isArray(ast)) {
        statements = ast;
      } else if (ast && typeof ast === 'object' && ast !== null) {
        // Single statement wrapped in array
        statements = [ast];
      } else {
        // Invalid AST shape - fallback to empty array (no complexity detected)
        statements = [];
      }

      let joins = 0;
      let cartesianJoins = 0;
      let subqueries = 0;
      let unions = 0;
      let intersects = 0;
      let excepts = 0;
      let recursiveCtes = 0;
      let aggregates = 0;
      let windows = 0;
      let wildcards = 0;
      let whereOrs = 0;
      let whereFunctions = 0;

      const visit = (node: unknown): void => {
        if (!node || typeof node !== 'object') {
          return;
        }
        const n = node as Record<string, unknown>;

        // Detect select columns
        if (n.type === 'select') {
          // WITH RECURSIVE
          if (
            n.with &&
            typeof n.with === 'object' &&
            n.with !== null &&
            'recursive' in n.with &&
            (n.with as Record<string, unknown>).recursive
          ) {
            recursiveCtes += 1;
          }

          // Columns
          if (Array.isArray(n.columns)) {
            for (const col of n.columns) {
              if (!col || typeof col !== 'object') {
                continue;
              }
              const colObj = col as Record<string, unknown>;
              const expr = ('expr' in colObj ? colObj.expr : colObj) as
                | Record<string, unknown>
                | undefined;
              if (expr && typeof expr === 'object' && 'type' in expr && expr.type === 'star') {
                wildcards += 1;
              }
              if (expr && typeof expr === 'object' && 'type' in expr && expr.type === 'aggr_func') {
                aggregates += 1;
              }
              // Window function
              if (expr && typeof expr === 'object' && 'over' in expr && expr.over) {
                windows += 1;
              }
              if (expr) {
                visit(expr);
              }
            }
          }

          // FROM/JOIN
          if (Array.isArray(n.from)) {
            let plainTables = 0;
            for (const fromItem of n.from) {
              if (!fromItem || typeof fromItem !== 'object') {
                continue;
              }
              const fromObj = fromItem as Record<string, unknown>;
              // Joined table
              if ('join' in fromObj && fromObj.join) {
                joins += 1;
                if (!('on' in fromObj) || !fromObj.on) {
                  cartesianJoins += 1;
                }
                if ('on' in fromObj) {
                  visit(fromObj.on);
                }
                if ('table' in fromObj) {
                  visit(fromObj.table);
                }
              } else {
                // Plain table in FROM list — if more than one without join, potential cartesian
                plainTables += 1;
                const tableOrItem = ('table' in fromObj ? fromObj.table : fromItem) as unknown;
                visit(tableOrItem);
              }
            }
            if (plainTables > 1) {
              // N plain tables produce N-1 cartesian join operations
              cartesianJoins += plainTables - 1;
            }
          }

          // WHERE analysis
          const walkWhere = (w: unknown): void => {
            if (!w || typeof w !== 'object') {
              return;
            }
            const wObj = w as Record<string, unknown>;
            if ('type' in wObj && wObj.type === 'binary_expr') {
              if ('operator' in wObj && String(wObj.operator).toUpperCase() === 'OR') {
                whereOrs += 1;
              }
              if ('left' in wObj) {
                walkWhere(wObj.left);
              }
              if ('right' in wObj) {
                walkWhere(wObj.right);
              }
            } else if ('type' in wObj && wObj.type === 'function') {
              whereFunctions += 1;
              if ('args' in wObj && Array.isArray(wObj.args)) {
                wObj.args.forEach(visit);
              } else if ('args' in wObj && wObj.args) {
                visit(wObj.args);
              }
            } else {
              visit(w);
            }
          };
          if ('where' in n) {
            walkWhere(n.where);
          }

          // Subqueries in different clauses
          const findSubqueries = (fsNode: unknown): void => {
            if (!fsNode || typeof fsNode !== 'object') {
              return;
            }
            const fsObj = fsNode as Record<string, unknown>;
            if ('type' in fsObj && fsObj.type === 'select') {
              subqueries += 1;
            }
            for (const key of Object.keys(fsObj)) {
              const v = fsObj[key];
              if (v && typeof v === 'object') {
                if (Array.isArray(v)) {
                  v.forEach(findSubqueries);
                } else {
                  findSubqueries(v);
                }
              }
            }
          };
          // Exclude counting the root select itself
          if ('where' in n) {
            findSubqueries(n.where);
          }
          if ('from' in n) {
            findSubqueries(n.from);
          }
          if ('columns' in n) {
            findSubqueries(n.columns);
          }
        }

        // Set operations might appear as nested structures depending on parser version
        if ('type' in n && typeof n.type === 'string') {
          const t = String(n.type).toLowerCase();
          if (t === 'union') {
            unions += 1;
          }
          if (t === 'intersect') {
            intersects += 1;
          }
          if (t === 'except') {
            excepts += 1;
          }
        }

        for (const key of Object.keys(n)) {
          const val = n[key];
          if (val && typeof val === 'object') {
            if (Array.isArray(val)) {
              val.forEach(visit);
            } else {
              visit(val);
            }
          }
        }
      };

      statements.forEach(visit);

      // Reset parse failure counter on successful parse for this query key
      const key = (query || '').trim().substring(0, 256);
      if (this.parseFailureCounts.has(key)) {
        this.parseFailureCounts.delete(key);
      }

      // Conservative approach: only count set operations when explicitly detected by parser
      // Do not increment unions based solely on statements.length to avoid false positives
      // for batch or independent semicolon-separated queries

      let complexity = 1;
      complexity += joins * this.weights.join;
      complexity += cartesianJoins * this.weights.cartesianJoin;
      complexity += subqueries * this.weights.subquery;
      complexity += unions * this.weights.union;
      complexity += intersects * this.weights.intersect;
      complexity += excepts * this.weights.except;
      complexity += recursiveCtes * this.weights.recursiveCte;
      complexity += aggregates * this.weights.aggregate;
      complexity += windows * this.weights.window;
      complexity += wildcards * this.weights.wildcard;
      complexity += whereOrs * this.weights.whereOr;
      complexity += whereFunctions * this.weights.whereFunction;

      return Math.min(complexity, Number.MAX_SAFE_INTEGER);
    } catch (err) {
      const key = query.trim().substring(0, 256);
      const prev = this.parseFailureCounts.get(key) ?? 0;
      const next = prev + 1;
      this.parseFailureCounts.set(key, next);

      // Conservative fallback: clamp to maxQueryComplexity - 1 (non-negative)
      const conservativeFallback = Math.max(0, this.maxQueryComplexity - 1);

      this.logger.warn('[Isolation] SQL parse failed; using conservative fallback complexity', {
        error: err instanceof Error ? err.message : String(err),
        query: query.substring(0, 200),
        fallbackComplexity: conservativeFallback,
        failures: next,
        threshold: this.parseFailureThreshold,
      });

      if (next > this.parseFailureThreshold) {
        this.logger.error('[Isolation] Repeated SQL parse failures exceeded threshold; rejecting query', {
          failures: next,
          threshold: this.parseFailureThreshold,
        });
        throw new Error('[Isolation] Rejected unparseable SQL after repeated failures');
      }

      return conservativeFallback;
    }
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

export function enforceResourceQuota(quota: InfraResourceLimits): ResourceQuotaEnforcer {
  return new ResourceQuotaEnforcer(quota);
}

export class ResourceQuotaEnforcer {
  constructor(private readonly quota: InfraResourceLimits) {}

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
