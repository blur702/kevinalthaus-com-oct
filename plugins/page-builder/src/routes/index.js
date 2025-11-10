"use strict";
/**
 * Page Builder API Routes
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPageBuilderRouter = createPageBuilderRouter;
const express_1 = require("express");
const page_service_1 = require("../services/page.service");
function createPageBuilderRouter(pool, logger, widgetRegistry) {
    const router = (0, express_1.Router)();
    const pageService = new page_service_1.PageService(pool);
    // Middleware to check capabilities
    const requireCapabilities = (capabilities) => {
        return (req, res, next) => {
            if (!req.user) {
                res.status(401).json({ error: 'Authentication required' });
                return;
            }
            const userCaps = Array.isArray(req.user.capabilities) ? req.user.capabilities : [];
            const hasCapabilities = capabilities.every((cap) => userCaps.includes(cap));
            if (!hasCapabilities) {
                res.status(403).json({
                    error: 'Insufficient permissions',
                    required: capabilities
                });
                return;
            }
            next();
        };
    };
    // =========================================================================
    // PAGE ROUTES
    // =========================================================================
    /**
     * List pages
     * GET /api/page-builder/pages
     */
    router.get('/pages', requireCapabilities(['database:read']), async (req, res) => {
        try {
            const { status, limit, offset, search, created_by } = req.query;
            const options = {
                status: status,
                limit: limit ? parseInt(limit) : 20,
                offset: offset ? parseInt(offset) : 0,
                search: search,
                created_by: created_by
            };
            const result = await pageService.listPages(options);
            res.json({
                success: true,
                data: result.pages,
                total: result.total,
                limit: options.limit,
                offset: options.offset
            });
        }
        catch (error) {
            logger.error('Failed to list pages:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to list pages'
            });
        }
    });
    /**
     * Get page by ID
     * GET /api/page-builder/pages/:id
     */
    router.get('/pages/:id', requireCapabilities(['database:read']), async (req, res) => {
        try {
            const { id } = req.params;
            const page = await pageService.getPageById(id);
            if (!page) {
                return res.status(404).json({
                    success: false,
                    error: 'Page not found'
                });
            }
            res.json({
                success: true,
                data: page
            });
        }
        catch (error) {
            logger.error('Failed to get page:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get page'
            });
        }
    });
    /**
     * Create page
     * POST /api/page-builder/pages
     */
    router.post('/pages', requireCapabilities(['database:write']), async (req, res) => {
        try {
            const { title, slug, layout_json, meta_description, meta_keywords, status, publish_at } = req.body;
            if (!title || !slug || !layout_json) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: title, slug, layout_json'
                });
            }
            const page = await pageService.createPage({
                title,
                slug,
                layout_json,
                meta_description,
                meta_keywords,
                status: status,
                publish_at: publish_at ? new Date(publish_at) : undefined,
                created_by: req.user.id
            });
            logger.info(`Page created: ${page.id} by user ${req.user.id}`);
            res.status(201).json({
                success: true,
                data: page
            });
        }
        catch (error) {
            logger.error('Failed to create page:', error);
            // Handle validation errors
            if (error.message && error.message.includes('Invalid')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
            // Handle unique constraint violations
            if (error.code === '23505') {
                return res.status(409).json({
                    success: false,
                    error: 'A page with this slug already exists'
                });
            }
            res.status(500).json({
                success: false,
                error: 'Failed to create page'
            });
        }
    });
    /**
     * Update page
     * PUT /api/page-builder/pages/:id
     */
    router.put('/pages/:id', requireCapabilities(['database:write']), async (req, res) => {
        try {
            const { id } = req.params;
            const { title, slug, layout_json, meta_description, meta_keywords, status, publish_at } = req.body;
            const page = await pageService.updatePage(id, {
                title,
                slug,
                layout_json,
                meta_description,
                meta_keywords,
                status: status,
                publish_at: publish_at ? new Date(publish_at) : undefined,
                updated_by: req.user.id
            });
            if (!page) {
                return res.status(404).json({
                    success: false,
                    error: 'Page not found'
                });
            }
            logger.info(`Page updated: ${page.id} by user ${req.user.id}`);
            res.json({
                success: true,
                data: page
            });
        }
        catch (error) {
            logger.error('Failed to update page:', error);
            if (error.message && error.message.includes('Invalid')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
            if (error.code === '23505') {
                return res.status(409).json({
                    success: false,
                    error: 'A page with this slug already exists'
                });
            }
            res.status(500).json({
                success: false,
                error: 'Failed to update page'
            });
        }
    });
    /**
     * Delete page (soft delete)
     * DELETE /api/page-builder/pages/:id
     */
    router.delete('/pages/:id', requireCapabilities(['database:write']), async (req, res) => {
        try {
            const { id } = req.params;
            const deleted = await pageService.deletePage(id, req.user.id);
            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    error: 'Page not found'
                });
            }
            logger.info(`Page deleted: ${id} by user ${req.user.id}`);
            res.json({
                success: true,
                message: 'Page deleted successfully'
            });
        }
        catch (error) {
            logger.error('Failed to delete page:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete page'
            });
        }
    });
    // =========================================================================
    // PAGE VERSION ROUTES
    // =========================================================================
    /**
     * Get page versions
     * GET /api/page-builder/pages/:id/versions
     */
    router.get('/pages/:id/versions', requireCapabilities(['database:read']), async (req, res) => {
        try {
            const { id } = req.params;
            const versions = await pageService.getPageVersions(id);
            res.json({
                success: true,
                data: versions
            });
        }
        catch (error) {
            logger.error('Failed to get page versions:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get page versions'
            });
        }
    });
    /**
     * Get specific page version
     * GET /api/page-builder/pages/:id/versions/:versionNumber
     */
    router.get('/pages/:id/versions/:versionNumber', requireCapabilities(['database:read']), async (req, res) => {
        try {
            const { id, versionNumber } = req.params;
            const version = await pageService.getPageVersion(id, parseInt(versionNumber));
            if (!version) {
                return res.status(404).json({
                    success: false,
                    error: 'Version not found'
                });
            }
            res.json({
                success: true,
                data: version
            });
        }
        catch (error) {
            logger.error('Failed to get page version:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get page version'
            });
        }
    });
    // =========================================================================
    // TEMPLATE ROUTES
    // =========================================================================
    /**
     * List templates
     * GET /api/page-builder/templates
     */
    router.get('/templates', requireCapabilities(['database:read']), async (req, res) => {
        try {
            const { category } = req.query;
            const templates = await pageService.listTemplates(req.user.id, category);
            res.json({
                success: true,
                data: templates
            });
        }
        catch (error) {
            logger.error('Failed to list templates:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to list templates'
            });
        }
    });
    /**
     * Create template
     * POST /api/page-builder/templates
     */
    router.post('/templates', requireCapabilities(['database:write']), async (req, res) => {
        try {
            const { name, description, thumbnail_url, layout_json, category, is_public } = req.body;
            if (!name || !layout_json) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: name, layout_json'
                });
            }
            const template = await pageService.createTemplate({
                name,
                description,
                thumbnail_url,
                layout_json,
                category,
                is_public: is_public || false,
                created_by: req.user.id
            });
            logger.info(`Template created: ${template.id} by user ${req.user.id}`);
            res.status(201).json({
                success: true,
                data: template
            });
        }
        catch (error) {
            logger.error('Failed to create template:', error);
            if (error.message && error.message.includes('Invalid')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
            res.status(500).json({
                success: false,
                error: 'Failed to create template'
            });
        }
    });
    // =========================================================================
    // REUSABLE BLOCK ROUTES
    // =========================================================================
    /**
     * List reusable blocks
     * GET /api/page-builder/reusable-blocks
     */
    router.get('/reusable-blocks', requireCapabilities(['database:read']), async (req, res) => {
        try {
            const { category } = req.query;
            const blocks = await pageService.listReusableBlocks(req.user.id, category);
            res.json({
                success: true,
                data: blocks
            });
        }
        catch (error) {
            logger.error('Failed to list reusable blocks:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to list reusable blocks'
            });
        }
    });
    /**
     * Create reusable block
     * POST /api/page-builder/reusable-blocks
     */
    router.post('/reusable-blocks', requireCapabilities(['database:write']), async (req, res) => {
        try {
            const { name, description, thumbnail_url, block_json, category } = req.body;
            if (!name || !block_json) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: name, block_json'
                });
            }
            const block = await pageService.createReusableBlock({
                name,
                description,
                thumbnail_url,
                block_json,
                category,
                created_by: req.user.id
            });
            logger.info(`Reusable block created: ${block.id} by user ${req.user.id}`);
            res.status(201).json({
                success: true,
                data: block
            });
        }
        catch (error) {
            logger.error('Failed to create reusable block:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create reusable block'
            });
        }
    });
    // =========================================================================
    // WIDGET REGISTRY ROUTES
    // =========================================================================
    /**
     * Get all widgets or filter by category
     * GET /api/page-builder/widgets?category=general
     */
    router.get('/widgets', requireCapabilities(['database:read']), async (req, res) => {
        try {
            const { category } = req.query;
            let widgets;
            if (category && typeof category === 'string') {
                widgets = widgetRegistry.getWidgetsByCategory(category);
            }
            else {
                widgets = widgetRegistry.getRegistry();
            }
            const categories = widgetRegistry.getCategories();
            res.json({
                success: true,
                data: {
                    widgets,
                    total: widgets.length,
                    categories,
                    version: '1.0'
                }
            });
        }
        catch (error) {
            logger.error('Failed to get widgets:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get widgets'
            });
        }
    });
    /**
     * Get widget by type
     * GET /api/page-builder/widgets/:type
     */
    router.get('/widgets/:type', requireCapabilities(['database:read']), async (req, res) => {
        try {
            const { type } = req.params;
            const widget = widgetRegistry.getWidgetByType(type);
            if (!widget) {
                return res.status(404).json({
                    success: false,
                    error: `Widget type '${type}' not found`
                });
            }
            res.json({
                success: true,
                data: widget
            });
        }
        catch (error) {
            logger.error('Failed to get widget:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get widget'
            });
        }
    });
    // =========================================================================
    // PUBLIC ROUTES
    // =========================================================================
    /**
     * Render published page by slug
     * GET /pages/:slug
     */
    router.get('/render/:slug', async (req, res) => {
        try {
            const { slug } = req.params;
            const page = await pageService.getPageBySlug(slug);
            if (!page || page.status !== 'published') {
                return res.status(404).json({
                    success: false,
                    error: 'Page not found'
                });
            }
            res.json({
                success: true,
                data: page
            });
        }
        catch (error) {
            logger.error('Failed to render page:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to render page'
            });
        }
    });
    return router;
}
//# sourceMappingURL=index.js.map