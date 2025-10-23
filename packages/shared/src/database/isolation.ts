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

export interface IsolationEnforcerOptions {
  limits: QueryExecutionLimits;
  weights?: Partial<ComplexityWeights>;
  fallbackComplexity?: number;
  logger?: (message: string, context?: Record<string, unknown>) => void;
}

export class DatabaseIsolationEnforcer {
  private readonly maxQueryComplexity: number;
  private readonly maxQueryRows: number;
  private readonly weights: ComplexityWeights;
  private readonly fallbackComplexity: number;
  private readonly logger: (message: string, context?: Record<string, unknown>) => void;

  constructor(limits: QueryExecutionLimits, weights?: Partial<ComplexityWeights>);
  constructor(options: IsolationEnforcerOptions);
  constructor(
    limitsOrOptions: QueryExecutionLimits | IsolationEnforcerOptions,
    weights: Partial<ComplexityWeights> = {}
  ) {
    // Support both legacy and new constructor signatures
    const options: IsolationEnforcerOptions =
      'limits' in limitsOrOptions ? limitsOrOptions : { limits: limitsOrOptions, weights };

    this.maxQueryComplexity = options.limits.maxQueryComplexity;
    this.maxQueryRows = options.limits.maxQueryRows;
    this.weights = { ...DEFAULT_COMPLEXITY_WEIGHTS, ...(options.weights || {}) };
    // Fallback defaults to maxQueryComplexity, which is more reasonable than MAX_SAFE_INTEGER
    this.fallbackComplexity = options.fallbackComplexity ?? options.limits.maxQueryComplexity;
    this.logger =
      options.logger ||
      ((message, context) => {
        // eslint-disable-next-line no-console
        console.error(message, context);
      });
  }

  // Note: This method does NOT enforce maxExecutionTime from QueryExecutionLimits.
  // Execution time limits must be applied at query execution time using database
  // timeout mechanisms (e.g., PostgreSQL's statement_timeout or query cancellation).
  // IMPORTANT: estimatedRows is required and must be a realistic estimate for the query.
  // Callers must compute or derive this value; there is no default to prevent bypassing enforcement.
  enforceQuotas(query: string, estimatedRows: number): void {
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
      throw new Error(`Query complexity ${complexity} exceeds limit ${this.maxQueryComplexity}`);
    }

    if (estimatedRows > this.maxQueryRows) {
      throw new Error(`Estimated rows ${estimatedRows} exceeds limit ${this.maxQueryRows}`);
    }
  }

  // AST-based complexity analysis using node-sql-parser to avoid string/comment false-positives
  private estimateQueryComplexity(query: string): number {
    // Lazy import to avoid burdening consumers who don't need this
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Parser } = require('node-sql-parser');
    const parser = new Parser();

    try {
      const ast = parser.astify(query, { database: 'PostgreSQL' });
      const statements = Array.isArray(ast) ? ast : [ast];

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

      // Approximate set operations if parser returned multiple statements (e.g., UNION chains)
      if (statements.length > 1 && unions === 0 && intersects === 0 && excepts === 0) {
        unions += statements.length - 1;
      }

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
      // If parsing fails, log details for debugging, then use configurable fallback complexity
      // Fallback defaults to maxQueryComplexity to prevent overly aggressive blocking
      this.logger('[Isolation] SQL parse failed; using fallback complexity', {
        error: err instanceof Error ? err.message : String(err),
        query,
        fallbackComplexity: this.fallbackComplexity,
      });
      return this.fallbackComplexity;
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
