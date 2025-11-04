/**
 * Database Service Implementation
 *
 * Provides database access with Knex query builder, repository pattern,
 * and schema isolation for plugins.
 */

import knex, { Knex } from 'knex';
import { Pool } from 'pg';
import type {
  IDatabaseService,
  IRepository,
  QueryOptions,
} from '@monorepo/shared';

/**
 * Repository Implementation
 * Provides type-safe CRUD operations for a specific table
 */
class Repository<T extends Record<string, unknown>> implements IRepository<T> {
  constructor(
    private knexInstance: Knex,
    private tableName: string
  ) {}

  async findAll(filters?: Partial<T>, options?: QueryOptions): Promise<T[]> {
    let query = this.knexInstance<T>(this.tableName);

    if (filters) {
      query = query.where(filters);
    }

    if (options?.orderBy) {
      for (const [column, direction] of Object.entries(options.orderBy)) {
        query = query.orderBy(column, direction);
      }
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return query.select('*') as unknown as Promise<T[]>;
  }

  async findById(id: string | number): Promise<T | null> {
    const result = await this.knexInstance<T>(this.tableName)
      .where({ id } as unknown as Partial<T>)
      .first();
    return (result as unknown as T) || null;
  }

  async findOne(filters: Partial<T>): Promise<T | null> {
    const result = await this.knexInstance<T>(this.tableName).where(filters).first();
    return (result as unknown as T) || null;
  }

  async create(data: Partial<T>): Promise<T> {
    const [result] = await this.knexInstance<T>(this.tableName)
      .insert(data as unknown as T)
      .returning('*');
    return result as unknown as T;
  }

  async update(id: string | number, data: Partial<T>): Promise<T> {
    const [result] = await this.knexInstance<T>(this.tableName)
      .where({ id } as unknown as Partial<T>)
      .update(data as unknown as Partial<T>)
      .returning('*');
    return result as unknown as T;
  }

  async delete(id: string | number): Promise<void> {
    await this.knexInstance<T>(this.tableName)
      .where({ id } as unknown as Partial<T>)
      .delete();
  }

  async count(filters?: Partial<T>): Promise<number> {
    const query = this.knexInstance<T>(this.tableName);
    if (filters) {
      query.where(filters);
    }
    const result = await query.count<{ count: string }>('* as count').first();
    return result ? parseInt(result.count, 10) : 0;
  }

  async exists(filters: Partial<T>): Promise<boolean> {
    const count = await this.count(filters);
    return count > 0;
  }

  query(): Knex.QueryBuilder {
    return this.knexInstance(this.tableName) as unknown as Knex.QueryBuilder;
  }
}

/**
 * Database Service
 * Manages Knex instances, schemas, and provides repository pattern
 */
export class DatabaseService implements IDatabaseService {
  public readonly name = 'database';
  private knexInstance: Knex | null = null;
  private pool: Pool | null = null;
  private initialized = false;

  constructor(private connectionConfig: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  }) {}

  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('DatabaseService is already initialized');
    }

    // Create Knex instance
    this.knexInstance = knex({
      client: 'pg',
      connection: this.connectionConfig,
      pool: {
        min: 2,
        max: 10,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 30000,
      },
      debug: process.env.NODE_ENV === 'development',
    });

    // Test connection
    try {
      await this.knexInstance.raw('SELECT 1');
      console.log('[DatabaseService] ✓ Connected to PostgreSQL');
    } catch (error) {
      throw new Error(
        `Failed to connect to database: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Get underlying pool
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.pool = (this.knexInstance.client as any).pool as Pool;

    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    if (!this.initialized || !this.knexInstance) {
      return;
    }

    try {
      await this.knexInstance.destroy();
      console.log('[DatabaseService] ✓ Disconnected from PostgreSQL');
    } catch (error) {
      console.error('[DatabaseService] ✗ Error during shutdown:', error);
    }

    this.knexInstance = null;
    this.pool = null;
    this.initialized = false;
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.initialized || !this.knexInstance) {
      return { healthy: false, message: 'Service not initialized' };
    }

    try {
      await this.knexInstance.raw('SELECT 1');
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        message: `Database connection failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  getKnex(schema?: string): Knex {
    if (!this.initialized || !this.knexInstance) {
      throw new Error('DatabaseService not initialized');
    }

    if (schema) {
      // Return Knex with schema prefix
      return this.knexInstance.withSchema(schema);
    }

    return this.knexInstance;
  }

  async raw<T = unknown>(sql: string, bindings?: unknown[]): Promise<T[]> {
    if (!this.initialized || !this.knexInstance) {
      throw new Error('DatabaseService not initialized');
    }

    const result = await this.knexInstance.raw(sql, bindings || []);
    return result.rows as T[];
  }

  async transaction<T>(
    callback: (trx: Knex.Transaction) => Promise<T>,
    schema?: string
  ): Promise<T> {
    if (!this.initialized || !this.knexInstance) {
      throw new Error('DatabaseService not initialized');
    }

    const knexToUse = schema ? this.knexInstance.withSchema(schema) : this.knexInstance;
    return knexToUse.transaction(callback);
  }

  getRepository<T>(schema: string, table: string): IRepository<T> {
    const knexWithSchema = this.getKnex(schema);
    return new Repository<T>(knexWithSchema, table) as unknown as IRepository<T>;
  }

  async createSchema(schemaName: string): Promise<void> {
    if (!this.initialized || !this.knexInstance) {
      throw new Error('DatabaseService not initialized');
    }

    await this.knexInstance.raw(`CREATE SCHEMA IF NOT EXISTS ??`, [schemaName]);
  }

  async dropSchema(schemaName: string, cascade = false): Promise<void> {
    if (!this.initialized || !this.knexInstance) {
      throw new Error('DatabaseService not initialized');
    }

    const cascadeClause = cascade ? 'CASCADE' : '';
    await this.knexInstance.raw(`DROP SCHEMA IF EXISTS ?? ${cascadeClause}`, [schemaName]);
  }

  async schemaExists(schemaName: string): Promise<boolean> {
    if (!this.initialized || !this.knexInstance) {
      throw new Error('DatabaseService not initialized');
    }

    const result = await this.knexInstance.raw(
      `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.schemata
        WHERE schema_name = ?
      ) as exists
    `,
      [schemaName]
    );

    return result.rows[0]?.exists || false;
  }

  getPool(): Pool {
    if (!this.initialized || !this.pool) {
      throw new Error('DatabaseService not initialized or pool not available');
    }
    return this.pool;
  }
}
