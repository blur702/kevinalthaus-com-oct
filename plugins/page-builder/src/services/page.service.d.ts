/**
 * Page Service
 * Database operations for pages, versions, templates, and reusable blocks
 */
import { Pool } from 'pg';
import { Page, PageVersion, Template, ReusableBlock, PageLayout, PageStatus } from '../types';
export interface CreatePageInput {
    title: string;
    slug: string;
    layout_json: PageLayout;
    meta_description?: string;
    meta_keywords?: string;
    status?: PageStatus;
    publish_at?: Date;
    created_by: string;
}
export interface UpdatePageInput {
    title?: string;
    slug?: string;
    layout_json?: PageLayout;
    meta_description?: string;
    meta_keywords?: string;
    status?: PageStatus;
    publish_at?: Date;
    updated_by: string;
}
export interface ListPagesOptions {
    status?: PageStatus;
    limit?: number;
    offset?: number;
    search?: string;
    created_by?: string;
}
export declare class PageService {
    private pool;
    constructor(pool: Pool);
    /**
     * Create a new page
     */
    createPage(input: CreatePageInput): Promise<Page>;
    /**
     * Get page by ID
     */
    getPageById(id: string, includeDeleted?: boolean): Promise<Page | null>;
    /**
     * Get page by slug
     */
    getPageBySlug(slug: string): Promise<Page | null>;
    /**
     * List pages with filtering and pagination
     */
    listPages(options?: ListPagesOptions): Promise<{
        pages: Page[];
        total: number;
    }>;
    /**
     * Update page
     */
    updatePage(id: string, input: UpdatePageInput): Promise<Page | null>;
    /**
     * Soft delete page
     */
    deletePage(id: string, deleted_by: string): Promise<boolean>;
    /**
     * Get page versions
     */
    getPageVersions(pageId: string): Promise<PageVersion[]>;
    /**
     * Get specific page version
     */
    getPageVersion(pageId: string, versionNumber: number): Promise<PageVersion | null>;
    /**
     * Create template from page
     */
    createTemplate(input: {
        name: string;
        description?: string;
        thumbnail_url?: string;
        layout_json: PageLayout;
        category?: string;
        is_public: boolean;
        created_by: string;
    }): Promise<Template>;
    /**
     * List templates
     */
    listTemplates(userId: string, category?: string): Promise<Template[]>;
    /**
     * Create reusable block
     */
    createReusableBlock(input: {
        name: string;
        description?: string;
        thumbnail_url?: string;
        block_json: any;
        category?: string;
        created_by: string;
    }): Promise<ReusableBlock>;
    /**
     * List reusable blocks
     */
    listReusableBlocks(userId: string, category?: string): Promise<ReusableBlock[]>;
    private mapRowToPage;
    private mapRowToPageVersion;
    private mapRowToTemplate;
    private mapRowToReusableBlock;
}
//# sourceMappingURL=page.service.d.ts.map