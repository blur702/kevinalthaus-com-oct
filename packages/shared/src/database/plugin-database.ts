export interface PluginDatabaseConfig {
  pluginId: string;
  schemaName: string;
  maxConnections?: number;
  isolationLevel?: IsolationLevel;
  readOnly?: boolean;
}

export enum IsolationLevel {
  READ_UNCOMMITTED = 'READ UNCOMMITTED',
  READ_COMMITTED = 'READ COMMITTED',
  REPEATABLE_READ = 'REPEATABLE READ',
  SERIALIZABLE = 'SERIALIZABLE',
}

export interface PluginDatabaseConnection {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;
  transaction<T>(callback: (trx: Transaction) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface Transaction {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface QueryResult {
  rowCount: number;
  insertId?: number | string;
  affectedRows?: number;
}

export interface PluginMigration {
  version: string;
  name: string;
  up: (connection: PluginDatabaseConnection) => Promise<void>;
  down: (connection: PluginDatabaseConnection) => Promise<void>;
}

export interface MigrationRecord {
  version: string;
  name: string;
  appliedAt: Date;
  executionTime: number;
}

export interface PluginSchema {
  pluginId: string;
  version: string;
  tables: TableDefinition[];
  indexes?: IndexDefinition[];
  foreignKeys?: ForeignKeyDefinition[];
}

export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  primaryKey?: string | string[];
  unique?: string[][];
  check?: string[];
}

export interface ColumnDefinition {
  name: string;
  type: ColumnType;
  length?: number;
  precision?: number;
  scale?: number;
  nullable?: boolean;
  default?: unknown;
  autoIncrement?: boolean;
  unsigned?: boolean;
}

export enum ColumnType {
  VARCHAR = 'VARCHAR',
  TEXT = 'TEXT',
  INTEGER = 'INTEGER',
  BIGINT = 'BIGINT',
  DECIMAL = 'DECIMAL',
  FLOAT = 'FLOAT',
  BOOLEAN = 'BOOLEAN',
  DATE = 'DATE',
  TIMESTAMP = 'TIMESTAMP',
  JSON = 'JSON',
  JSONB = 'JSONB',
  UUID = 'UUID',
  BINARY = 'BINARY',
}

export interface IndexDefinition {
  name: string;
  table: string;
  columns: string[];
  unique?: boolean;
  type?: 'btree' | 'hash' | 'gin' | 'gist';
}

export interface ForeignKeyDefinition {
  name: string;
  table: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

export interface DatabaseConnectionPool {
  acquire(pluginId: string): Promise<PluginDatabaseConnection>;
  release(connection: PluginDatabaseConnection): Promise<void>;
  drain(): Promise<void>;
  getStats(): PoolStats;
}

export interface PoolStats {
  totalConnections: number;
  idleConnections: number;
  activeConnections: number;
  waitingRequests: number;
}
