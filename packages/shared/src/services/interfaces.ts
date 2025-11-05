/**
 * Service Layer Interfaces
 *
 * This file defines the contracts for all services available to plugins and the application.
 * Services provide a clean abstraction layer for common functionality like authentication,
 * database access, logging, etc.
 */

import type { Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import type Knex from 'knex';
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
  id?: string; // Optional alias for compatibility with User/UserContext
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
  createdAt: Date; // Required for compatibility with User type
  updatedAt: Date; // Required for compatibility with User type
  userId?: string; // Optional alias for compatibility with TokenPayload
}

// ============================================================================
// Database Service Interface
// ============================================================================

export interface IDatabaseService extends IService {
  /**
   * Get Knex query builder for schema
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getKnex(schema?: string): any;

  /**
   * Execute raw SQL query (use sparingly, prefer query builder)
   */
  raw<T = unknown>(sql: string, bindings?: unknown[]): Promise<T[]>;

  /**
   * Start a transaction
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transaction<T>(
    callback: (trx: any) => Promise<T>,
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
// File Storage Service Interface
// ============================================================================

/**
 * Metadata about a file or directory
 */
export interface StorageMetadata {
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  isDirectory: boolean;
  mimeType?: string;
}

/**
 * File storage service for managing files and directories
 */
export interface IFileStorageService extends IService {
  /**
   * Read file contents
   */
  readFile(filePath: string): Promise<Buffer>;

  /**
   * Write file contents
   */
  writeFile(filePath: string, data: Buffer | string): Promise<void>;

  /**
   * Delete a file
   */
  deleteFile(filePath: string): Promise<void>;

  /**
   * Check if file or directory exists
   */
  exists(filePath: string): Promise<boolean>;

  /**
   * Get file metadata
   */
  getMetadata(filePath: string): Promise<StorageMetadata>;

  /**
   * List files in directory
   */
  listFiles(dirPath: string): Promise<string[]>;

  /**
   * Create directory
   */
  createDirectory(dirPath: string): Promise<void>;

  /**
   * Delete directory
   */
  deleteDirectory(dirPath: string, recursive?: boolean): Promise<void>;

  /**
   * Move file
   */
  moveFile(sourcePath: string, destPath: string): Promise<void>;

  /**
   * Copy file
   */
  copyFile(sourcePath: string, destPath: string): Promise<void>;

  /**
   * Get public URL for file
   */
  getPublicUrl(filePath: string): string;

  /**
   * Create read stream for file
   */
  createReadStream(filePath: string): NodeJS.ReadableStream;

  /**
   * Create write stream for file
   */
  createWriteStream(filePath: string): NodeJS.WritableStream;
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
// Blog Service Interface
// ============================================================================

/**
 * Blog post data for creation
 */
export interface CreateBlogPostData {
  title: string;
  slug?: string;
  body_html: string;
  excerpt?: string;
  meta_description?: string;
  meta_keywords?: string;
  reading_time_minutes?: number;
  allow_comments?: boolean;
  featured_image_id?: string;
  status?: 'draft' | 'published' | 'scheduled';
  publish_at?: string;
}

/**
 * Blog post data for updates
 */
export interface UpdateBlogPostData {
  title?: string;
  slug?: string;
  body_html?: string;
  excerpt?: string;
  meta_description?: string;
  meta_keywords?: string;
  reading_time_minutes?: number;
  allow_comments?: boolean;
  featured_image_id?: string;
  status?: 'draft' | 'published' | 'scheduled';
  publish_at?: string;
}

/**
 * Blog post from database
 */
export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  body_html: string;
  excerpt?: string;
  meta_description?: string;
  meta_keywords?: string;
  author_id: string;
  author_email?: string;
  author_display_name?: string;
  author_bio?: string;
  author_avatar_url?: string;
  reading_time_minutes?: number;
  allow_comments: boolean;
  featured_image_id?: string;
  status: string;
  published_at?: Date;
  publish_at?: Date;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
  created_by: string;
  updated_by?: string;
  deleted_by?: string;
}

/**
 * Paginated blog post list
 */
export interface BlogPostList {
  posts: BlogPost[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * Blog Service Interface
 * Manages blog posts and related operations
 */
export interface IBlogService extends IService {
  /**
   * List all blog posts with pagination and optional filtering
   */
  listPosts(options: {
    page?: number;
    limit?: number;
    status?: string;
    authorId?: string;
  }): Promise<BlogPostList>;

  /**
   * List published blog posts (public endpoint)
   */
  listPublishedPosts(options: {
    page?: number;
    limit?: number;
  }): Promise<BlogPostList>;

  /**
   * Get a single blog post by ID
   */
  getPostById(id: string): Promise<BlogPost | null>;

  /**
   * Create a new blog post
   */
  createPost(data: CreateBlogPostData, userId: string): Promise<BlogPost>;

  /**
   * Update an existing blog post
   */
  updatePost(id: string, data: UpdateBlogPostData, userId: string): Promise<BlogPost | null>;

  /**
   * Delete a blog post (soft delete)
   */
  deletePost(id: string, userId: string): Promise<boolean>;

  /**
   * Publish a blog post
   */
  publishPost(id: string, userId: string): Promise<BlogPost | null>;

  /**
   * Unpublish a blog post
   */
  unpublishPost(id: string, userId: string): Promise<BlogPost | null>;

  /**
   * Check if slug exists
   */
  slugExists(slug: string, excludeId?: string): Promise<boolean>;
}

// ============================================================================
// Taxonomy Service Interface
// ============================================================================

/**
 * Vocabulary entity
 */
export interface Vocabulary {
  id: string;
  name: string;
  machine_name: string;
  description?: string;
  hierarchy_depth: number;
  allow_multiple: boolean;
  required: boolean;
  weight: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Term entity
 */
export interface Term {
  id: string;
  vocabulary_id: string;
  name: string;
  slug: string;
  description?: string;
  parent_id?: string;
  weight: number;
  meta_data?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

/**
 * Entity-Term association
 */
export interface EntityTerm {
  id: string;
  entity_type: string;
  entity_id: string;
  term_id: string;
  created_at: Date;
}

/**
 * Data for creating a vocabulary
 */
export interface CreateVocabularyData {
  name: string;
  machine_name: string;
  description?: string;
  hierarchy_depth?: number;
  allow_multiple?: boolean;
  required?: boolean;
  weight?: number;
}

/**
 * Data for updating a vocabulary
 */
export interface UpdateVocabularyData {
  name?: string;
  description?: string;
  hierarchy_depth?: number;
  allow_multiple?: boolean;
  required?: boolean;
  weight?: number;
}

/**
 * Data for creating a term
 */
export interface CreateTermData {
  vocabulary_id: string;
  name: string;
  slug?: string;
  description?: string;
  parent_id?: string;
  weight?: number;
  meta_data?: Record<string, unknown>;
}

/**
 * Data for updating a term
 */
export interface UpdateTermData {
  name?: string;
  slug?: string;
  description?: string;
  parent_id?: string;
  weight?: number;
  meta_data?: Record<string, unknown>;
}

/**
 * Taxonomy Service Interface
 * Manages vocabularies and terms similar to Drupal's taxonomy system
 */
export interface ITaxonomyService extends IService {
  // Vocabulary management
  createVocabulary(data: CreateVocabularyData): Promise<Vocabulary>;
  getVocabulary(id: string): Promise<Vocabulary | null>;
  getVocabularyByMachineName(machineName: string): Promise<Vocabulary | null>;
  getAllVocabularies(): Promise<Vocabulary[]>;
  updateVocabulary(id: string, data: UpdateVocabularyData): Promise<Vocabulary>;
  deleteVocabulary(id: string): Promise<void>;

  // Term management
  createTerm(data: CreateTermData): Promise<Term>;
  getTerm(id: string): Promise<Term | null>;
  getTermBySlug(vocabularyId: string, slug: string): Promise<Term | null>;
  getTermsByVocabulary(vocabularyId: string): Promise<Term[]>;
  getTermChildren(parentId: string): Promise<Term[]>;
  updateTerm(id: string, data: UpdateTermData): Promise<Term>;
  deleteTerm(id: string): Promise<void>;

  // Entity-Term associations
  assignTermToEntity(entityType: string, entityId: string, termId: string): Promise<EntityTerm>;
  removeTermFromEntity(entityType: string, entityId: string, termId: string): Promise<void>;
  getEntityTerms(entityType: string, entityId: string): Promise<Term[]>;
  getEntitiesByTerm(entityType: string, termId: string): Promise<string[]>;
  clearEntityTerms(entityType: string, entityId: string, vocabularyId?: string): Promise<void>;

  // Utility methods
  buildTermHierarchy(vocabularyId: string): Promise<Term[]>;
  searchTerms(vocabularyId: string, query: string): Promise<Term[]>;
  validateEntityTerms(entityType: string, termIds: string[]): Promise<boolean>;
}

// ============================================================================
// Service Collection (for PluginExecutionContext)
// ============================================================================

/**
 * Collection of all services available to plugins
 */
export interface IServiceCollection {
  auth: IAuthService;
  blog: IBlogService;
  database: IDatabaseService;
  editor: IEditorService;
  http: IHttpService;
  storage: IFileStorageService;
  logger: ILoggerService;
  taxonomy: ITaxonomyService;
}
