

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

export class DatabaseIsolationEnforcer {
  private readonly maxQueryComplexity: number;
  private readonly maxQueryRows: number;
  private readonly weights: ComplexityWeights;

  constructor(limits: QueryExecutionLimits, weights: Partial<ComplexityWeights> = {}) {
    this.maxQueryComplexity = limits.maxQueryComplexity;
    this.maxQueryRows = limits.maxQueryRows;
    this.weights = { ...DEFAULT_COMPLEXITY_WEIGHTS, ...weights };
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

      const visit = (node: any): void => {
        if (!node || typeof node !== 'object') return;

        // Detect select columns
        if (node.type === 'select') {
          // WITH RECURSIVE
          if (node.with && node.with.recursive) {
            recursiveCtes += 1;
          }

          // Columns
          if (Array.isArray(node.columns)) {
            for (const col of node.columns) {
              const expr = col && (col.expr || col);
              if (expr && expr.type === 'star') {
                wildcards += 1;
              }
              if (expr && expr.type === 'aggr_func') {
                aggregates += 1;
              }
              // Window function
              if (expr && expr.over) {
                windows += 1;
              }
              visit(expr);
            }
          }

          // FROM/JOIN
          if (Array.isArray(node.from)) {
            let plainTables = 0;
            for (const fromItem of node.from) {
              // Joined table
              if (fromItem && fromItem.join) {
                joins += 1;
                if (!fromItem.on) {
                  cartesianJoins += 1;
                }
                visit(fromItem.on);
                visit(fromItem.table);
              } else {
                // Plain table in FROM list — if more than one without join, potential cartesian
                plainTables += 1;
                visit(fromItem.table || fromItem);
              }
            }
            if (plainTables > 1) {
              // N plain tables produce N-1 cartesian join operations
              cartesianJoins += (plainTables - 1);
            }
          }

          // WHERE analysis
          const walkWhere = (w: any): void => {
            if (!w) return;
            if (w.type === 'binary_expr') {
              if (String(w.operator).toUpperCase() === 'OR') {
                whereOrs += 1;
              }
              walkWhere(w.left);
              walkWhere(w.right);
            } else if (w.type === 'function') {
              whereFunctions += 1;
              if (Array.isArray(w.args)) {
                w.args.forEach(visit);
              } else if (w.args) {
                visit(w.args);
              }
            } else {
              visit(w);
            }
          };
          walkWhere(node.where);

          // Subqueries in different clauses
          const findSubqueries = (n: any): void => {
            if (!n || typeof n !== 'object') return;
            if (n.type === 'select') {
              subqueries += 1;
            }
            for (const key of Object.keys(n)) {
              const v = (n as any)[key];
              if (v && typeof v === 'object') {
                if (Array.isArray(v)) v.forEach(findSubqueries);
                else findSubqueries(v);
              }
            }
          };
          // Exclude counting the root select itself
          if (node.where) findSubqueries(node.where);
          if (node.from) findSubqueries(node.from);
          if (node.columns) findSubqueries(node.columns);
        }

        // Set operations might appear as nested structures depending on parser version
        if (node.type && typeof node.type === 'string') {
          const t = String(node.type).toLowerCase();
          if (t === 'union') unions += 1;
          if (t === 'intersect') intersects += 1;
          if (t === 'except') excepts += 1;
        }

        for (const key of Object.keys(node)) {
          const val = (node as any)[key];
          if (val && typeof val === 'object') {
            if (Array.isArray(val)) val.forEach(visit);
            else visit(val);
          }
        }
      };

      statements.forEach(visit);

      // Approximate set operations if parser returned multiple statements (e.g., UNION chains)
      if (statements.length > 1 && unions === 0 && intersects === 0 && excepts === 0) {
        unions += (statements.length - 1);
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
    } catch {
      // If parsing fails, conservatively treat as very complex to protect resources
      return Number.MAX_SAFE_INTEGER;
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
