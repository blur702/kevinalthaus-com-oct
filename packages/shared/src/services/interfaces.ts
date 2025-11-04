/**
 * Service Layer Interfaces
 *
 * This file defines the contracts for all services available to plugins and the application.
 * Services provide a clean abstraction layer for common functionality like authentication,
 * database access, logging, etc.
 */

import type { Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import type { Knex } from 'knex';
import type { Role, Capability } from '../security/rbac';

// ============================================================================
// Base Service Interface
// ============================================================================

/**
 * Base interface that all services implement
 */
export interface IService {
  /**
   * Service name for identification and logging
   */
  readonly name: string;

  /**
   * Initialize the service (called once at startup)
   */
  initialize(): Promise<void>;

  /**
   * Cleanup resources (called on shutdown)
   */
  shutdown(): Promise<void>;

  /**
   * Health check for the service
   */
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
}

// ============================================================================
// Auth Service Interface
// ============================================================================

export interface IAuthService extends IService {
  /**
   * Register a new user
   */
  register(data: {
    email: string;
    username: string;
    password: string;
    role?: Role;
  }): Promise<AuthResult>;

  /**
   * Authenticate user and return tokens
   */
  login(data: {
    identifier: string; // username or email
    password: string;
    userAgent?: string;
  }): Promise<LoginResult>;

  /**
   * Logout user and invalidate refresh token
   */
  logout(refreshToken: string): Promise<void>;

  /**
   * Validate an access token and return payload
   */
  validateToken(token: string): Promise<TokenPayload>;

  /**
   * Refresh access token using refresh token
   */
  refreshTokens(data: {
    refreshToken: string;
    userAgent?: string;
  }): Promise<TokenPair>;

  /**
   * Initiate password reset flow
   */
  forgotPassword(email: string): Promise<{ resetToken: string }>;

  /**
   * Complete password reset
   */
  resetPassword(data: { token: string; newPassword: string }): Promise<void>;

  /**
   * Change password for authenticated user
   */
  changePassword(data: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<void>;

  /**
   * Get current user from request
   */
  getCurrentUser(req: Request): Promise<UserContext | null>;

  /**
   * Check if user has specific role
   */
  hasRole(user: UserContext, role: Role): boolean;

  /**
   * Check if user has specific capability
   */
  hasCapability(user: UserContext, capability: Capability): boolean;

  /**
   * Express middleware for authentication
   */
  middleware(): (req: Request, res: Response, next: NextFunction) => Promise<void>;

  /**
   * Express middleware for role-based authorization
   */
  requireRole(role: Role): (req: Request, res: Response, next: NextFunction) => Promise<void>;

  /**
   * Express middleware for capability-based authorization
   */
  requireCapability(
    capability: Capability
  ): (req: Request, res: Response, next: NextFunction) => Promise<void>;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    username: string;
    role: Role;
  };
}

export interface LoginResult extends AuthResult {
  tokens: TokenPair;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TokenPayload {
  userId: string;
  email: string;
  username: string;
  role: Role;
  iat: number;
  exp: number;
}

/**
 * User context for authentication and authorization
 * Contains user identity and permissions
 */
export interface UserContext {
  id: string;
  email: string;
  username: string;
  role: Role;
  capabilities: Capability[];
  createdAt?: Date; // Optional for compatibility with User type
  updatedAt?: Date; // Optional for compatibility with User type
}

// ============================================================================
// Database Service Interface
// ============================================================================

export interface IDatabaseService extends IService {
  /**
   * Get Knex query builder for schema
   */
  getKnex(schema?: string): Knex;

  /**
   * Execute raw SQL query (use sparingly, prefer query builder)
   */
  raw<T = unknown>(sql: string, bindings?: unknown[]): Promise<T[]>;

  /**
   * Start a transaction
   */
  transaction<T>(
    callback: (trx: Knex.Transaction) => Promise<T>,
    schema?: string
  ): Promise<T>;

  /**
   * Get repository for a table
   */
  getRepository<T>(schema: string, table: string): IRepository<T>;

  /**
   * Create a new schema (for plugins)
   */
  createSchema(schemaName: string): Promise<void>;

  /**
   * Drop a schema (for plugin uninstall)
   */
  dropSchema(schemaName: string, cascade?: boolean): Promise<void>;

  /**
   * Check if schema exists
   */
  schemaExists(schemaName: string): Promise<boolean>;

  /**
   * Get underlying pool (for advanced use cases)
   */
  getPool(): Pool;
}

/**
 * Repository pattern for type-safe database operations
 */
export interface IRepository<T> {
  /**
   * Find all records with optional filters
   */
  findAll(filters?: Partial<T>, options?: QueryOptions): Promise<T[]>;

  /**
   * Find single record by ID
   */
  findById(id: string | number): Promise<T | null>;

  /**
   * Find single record by filters
   */
  findOne(filters: Partial<T>): Promise<T | null>;

  /**
   * Create new record
   */
  create(data: Partial<T>): Promise<T>;

  /**
   * Update record by ID
   */
  update(id: string | number, data: Partial<T>): Promise<T>;

  /**
   * Delete record by ID
   */
  delete(id: string | number): Promise<void>;

  /**
   * Count records with optional filters
   */
  count(filters?: Partial<T>): Promise<number>;

  /**
   * Check if record exists
   */
  exists(filters: Partial<T>): Promise<boolean>;

  /**
   * Get Knex query builder for custom queries
   */
  query(): Knex.QueryBuilder;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string | string[];
  orderDirection?: 'asc' | 'desc';
}

// ============================================================================
// Editor Service Interface
// ============================================================================

export interface IEditorService extends IService {
  /**
   * Serialize editor content to HTML
   */
  toHTML(content: EditorContent): string;

  /**
   * Parse HTML into editor content structure
   */
  fromHTML(html: string): EditorContent;

  /**
   * Validate editor content
   */
  validate(content: EditorContent): ValidationResult;

  /**
   * Sanitize HTML content (remove malicious tags/attributes)
   */
  sanitize(html: string): string;

  /**
   * Extract plain text from editor content
   */
  toPlainText(content: EditorContent): string;

  /**
   * Get word count
   */
  getWordCount(content: EditorContent): number;

  /**
   * Get character count
   */
  getCharacterCount(content: EditorContent): number;

  /**
   * Handle image upload and return URL
   */
  uploadImage(file: File | Buffer, metadata?: ImageMetadata): Promise<ImageResult>;

  /**
   * Create empty editor content
   */
  createEmpty(): EditorContent;
}

export interface EditorContent {
  type: 'doc';
  content: EditorNode[];
  version?: number;
}

export interface EditorNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: EditorNode[];
  text?: string;
  marks?: EditorMark[];
}

export interface EditorMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface ImageMetadata {
  alt?: string;
  title?: string;
  caption?: string;
}

export interface ImageResult {
  url: string;
  width: number;
  height: number;
  size: number;
  format: string;
}

// ============================================================================
// HTTP Service Interface
// ============================================================================

export interface IHttpService extends IService {
  /**
   * GET request
   */
  get<T = unknown>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>;

  /**
   * POST request
   */
  post<T = unknown>(
    url: string,
    data?: unknown,
    options?: HttpRequestOptions
  ): Promise<HttpResponse<T>>;

  /**
   * PUT request
   */
  put<T = unknown>(
    url: string,
    data?: unknown,
    options?: HttpRequestOptions
  ): Promise<HttpResponse<T>>;

  /**
   * PATCH request
   */
  patch<T = unknown>(
    url: string,
    data?: unknown,
    options?: HttpRequestOptions
  ): Promise<HttpResponse<T>>;

  /**
   * DELETE request
   */
  delete<T = unknown>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>;

  /**
   * Set default headers for all requests
   */
  setDefaultHeader(key: string, value: string): void;

  /**
   * Set base URL for relative requests
   */
  setBaseURL(url: string): void;

  /**
   * Add request interceptor
   */
  addRequestInterceptor(
    interceptor: (config: HttpRequestOptions) => HttpRequestOptions | Promise<HttpRequestOptions>
  ): void;

  /**
   * Add response interceptor
   */
  addResponseInterceptor<T>(
    interceptor: (response: HttpResponse<T>) => HttpResponse<T> | Promise<HttpResponse<T>>
  ): void;
}

export interface HttpRequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  timeout?: number;
  withCredentials?: boolean;
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer';
  validateStatus?: (status: number) => boolean;
  maxRedirects?: number;
  retry?: {
    retries: number;
    retryDelay?: number;
    retryCondition?: (error: unknown) => boolean;
  };
}

export interface HttpResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: HttpRequestOptions;
}

// ============================================================================
// Storage Service Interface
// ============================================================================

export interface IStorageService extends IService {
  /**
   * Get value by key
   */
  get<T = unknown>(key: string): Promise<T | null>;

  /**
   * Set value with optional TTL (in seconds)
   */
  set<T = unknown>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Delete value by key
   */
  delete(key: string): Promise<void>;

  /**
   * Check if key exists
   */
  has(key: string): Promise<boolean>;

  /**
   * Get all keys matching pattern
   */
  keys(pattern?: string): Promise<string[]>;

  /**
   * Clear all keys
   */
  clear(): Promise<void>;

  /**
   * Get multiple values by keys
   */
  getMany<T = unknown>(keys: string[]): Promise<(T | null)[]>;

  /**
   * Set multiple key-value pairs
   */
  setMany<T = unknown>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void>;

  /**
   * Delete multiple keys
   */
  deleteMany(keys: string[]): Promise<void>;

  /**
   * Increment numeric value
   */
  increment(key: string, amount?: number): Promise<number>;

  /**
   * Decrement numeric value
   */
  decrement(key: string, amount?: number): Promise<number>;

  /**
   * Set value with expiration timestamp
   */
  setWithExpiry<T = unknown>(key: string, value: T, expiryTimestamp: number): Promise<void>;

  /**
   * Get TTL for key (in seconds, -1 if no TTL, -2 if doesn't exist)
   */
  getTTL(key: string): Promise<number>;
}

// ============================================================================
// Logger Service Interface (already exists, formalize here)
// ============================================================================

export interface ILoggerService extends IService {
  /**
   * Log debug message
   */
  debug(message: string, meta?: Record<string, unknown>): void;

  /**
   * Log info message
   */
  info(message: string, meta?: Record<string, unknown>): void;

  /**
   * Log warning message
   */
  warn(message: string, meta?: Record<string, unknown>): void;

  /**
   * Log error message
   */
  error(message: string, meta?: Record<string, unknown>): void;

  /**
   * Create child logger with context
   */
  child(context: Record<string, unknown>): ILoggerService;

  /**
   * Set log level
   */
  setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void;
}

// ============================================================================
// Service Container Interface
// ============================================================================

/**
 * Service container for dependency injection
 */
export interface IServiceContainer {
  /**
   * Register a service
   */
  register<T extends IService>(name: string, service: T): void;

  /**
   * Get a service by name
   */
  get<T extends IService>(name: string): T;

  /**
   * Check if service is registered
   */
  has(name: string): boolean;

  /**
   * Initialize all services
   */
  initializeAll(): Promise<void>;

  /**
   * Shutdown all services
   */
  shutdownAll(): Promise<void>;

  /**
   * Get all service names
   */
  getServiceNames(): string[];

  /**
   * Health check for all services
   */
  healthCheckAll(): Promise<Map<string, { healthy: boolean; message?: string }>>;
}

// ============================================================================
// Service Collection (for PluginExecutionContext)
// ============================================================================

/**
 * Collection of all services available to plugins
 */
export interface IServiceCollection {
  auth: IAuthService;
  database: IDatabaseService;
  editor: IEditorService;
  http: IHttpService;
  storage: IStorageService;
  logger: ILoggerService;
}
