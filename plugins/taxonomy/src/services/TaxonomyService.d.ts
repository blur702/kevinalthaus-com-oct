/**
 * Shared Taxonomy Service
 * Provides category and tag management for all plugins
 */
import { Pool } from 'pg';
import type { PluginLogger } from '@monorepo/shared';
import type { Category, Tag, CreateCategoryInput, UpdateCategoryInput, CreateTagInput, UpdateTagInput, CategoryTree, TaxonomyQueryOptions } from '../types';
export declare class TaxonomyService {
    private pool;
    private logger;
    constructor(pool: Pool, logger: PluginLogger);
    /**
     * Generate slug from name
     */
    private generateSlug;
    /**
     * Create a new category
     */
    createCategory(input: CreateCategoryInput, userId: string): Promise<Category>;
    /**
     * Get category by ID
     */
    getCategory(id: string): Promise<Category | null>;
    /**
     * List categories with optional filtering
     */
    listCategories(options?: TaxonomyQueryOptions): Promise<{
        data: Category[];
        pagination: {
            page: number;
            page_size: number;
            total_count: number;
            total_pages: number;
        };
    }>;
    /**
     * Build category tree from flat list
     */
    buildCategoryTree(categories: Category[], parentId?: string | null): CategoryTree[];
    /**
     * Get category tree for a namespace
     */
    getCategoryTree(namespace: string): Promise<CategoryTree[]>;
    /**
     * Update category
     */
    updateCategory(id: string, input: UpdateCategoryInput, userId: string): Promise<Category | null>;
    /**
     * Delete category
     */
    deleteCategory(id: string): Promise<boolean>;
    /**
     * Create a new tag
     */
    createTag(input: CreateTagInput, userId: string): Promise<Tag>;
    /**
     * Get tag by ID
     */
    getTag(id: string): Promise<Tag | null>;
    /**
     * List tags with optional filtering
     */
    listTags(options?: TaxonomyQueryOptions): Promise<{
        data: Tag[];
        pagination: {
            page: number;
            page_size: number;
            total_count: number;
            total_pages: number;
        };
    }>;
    /**
     * Update tag
     */
    updateTag(id: string, input: UpdateTagInput): Promise<Tag | null>;
    /**
     * Delete tag
     */
    deleteTag(id: string): Promise<boolean>;
    /**
     * Attach categories to an entity
     */
    attachCategories(namespace: string, entityId: string, categoryIds: string[]): Promise<void>;
    /**
     * Get categories for an entity
     */
    getEntityCategories(namespace: string, entityId: string): Promise<Category[]>;
    /**
     * Attach tags to an entity
     */
    attachTags(namespace: string, entityId: string, tagIds: string[]): Promise<void>;
    /**
     * Get tags for an entity
     */
    getEntityTags(namespace: string, entityId: string): Promise<Tag[]>;
}
//# sourceMappingURL=TaxonomyService.d.ts.map