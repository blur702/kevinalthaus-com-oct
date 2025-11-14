import { Router, Response, RequestHandler } from 'express';
import { query } from '../db';
import { AuthenticatedRequest, authMiddleware } from '../auth';
import { requireRole } from '../auth/rbac-middleware';
import { createLogger, LogLevel, stripAllHTML, Role } from '@monorepo/shared';
import { csrfProtection, attachCSRFToken } from '../middleware/csrf';
import { aiServicesRateLimit, aiPromptsRateLimit } from '../middleware/rateLimitRedis';
import { secretsService } from '../services/secretsService';

const router = Router();
const logger = createLogger({
  service: 'ai-services',
  level: LogLevel.INFO,
});

import { asyncHandler } from '../utils/asyncHandler';

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

// Apply authentication and admin role requirement to all routes
router.use(authMiddleware);
router.use(requireRole(Role.ADMIN));
router.use(attachCSRFToken);

// Security headers middleware
router.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface AIServiceConfig {
  id: string;
  service_name: string;
  api_key_vault_path?: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  api_key_configured?: boolean;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by?: string;
}

interface AIPromptCategory {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by?: string;
  children?: AIPromptCategory[];
}

interface AIPrompt {
  id: string;
  title: string;
  content: string;
  category_id?: string;
  variables: string[];
  metadata: Record<string, unknown>;
  is_favorite: boolean;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by?: string;
  category_name?: string;
}

interface CreatePromptRequest {
  title: string;
  content: string;
  category_id?: string;
  variables?: string[];
  metadata?: Record<string, unknown>;
  is_favorite?: boolean;
}

interface UpdatePromptRequest {
  title?: string;
  content?: string;
  category_id?: string;
  variables?: string[];
  metadata?: Record<string, unknown>;
  is_favorite?: boolean;
}

interface UpdateServiceRequest {
  api_key?: string;
  enabled?: boolean;
  settings?: Record<string, unknown>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Log audit events for AI services actions
 */
async function logAudit(
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, resourceType, resourceId, JSON.stringify(details || {})]
    );
  } catch (error) {
    logger.error('Failed to log audit event', toError(error), { userId, action, resourceType, resourceId });
  }
}

/**
 * Validate service name
 */
function validateServiceName(serviceName: string): boolean {
  const validServices = ['claude', 'chatgpt', 'gemini', 'deepseek'];
  return validServices.includes(serviceName.toLowerCase());
}

/**
 * Build hierarchical category structure
 */
function buildCategoryHierarchy(categories: AIPromptCategory[]): AIPromptCategory[] {
  const categoryMap = new Map<string, AIPromptCategory>();
  const rootCategories: AIPromptCategory[] = [];

  // First pass: create map of all categories
  categories.forEach((cat) => {
    categoryMap.set(cat.id, { ...cat, children: [] });
  });

  // Second pass: build hierarchy
  categories.forEach((cat) => {
    const category = categoryMap.get(cat.id)!;
    if (cat.parent_id) {
      const parent = categoryMap.get(cat.parent_id);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(category);
      } else {
        logger.warn('Orphaned category detected: parent not found, promoting to root', {
          categoryId: cat.id,
          categoryName: cat.name,
          parentId: cat.parent_id,
        });
        rootCategories.push(category);
      }
    } else {
      rootCategories.push(category);
    }
  });

  return rootCategories;
}

/**
 * Check for circular parent references
 */
async function hasCircularReference(categoryId: string, newParentId: string): Promise<boolean> {
  let currentParentId: string | null = newParentId;
  const visited = new Set<string>();

  while (currentParentId) {
    if (currentParentId === categoryId || visited.has(currentParentId)) {
      return true;
    }
    visited.add(currentParentId);

    const parentRows: Array<{ parent_id: string | null }> = (
      await query<{ parent_id: string | null }>(
        'SELECT parent_id FROM ai_prompt_categories WHERE id = $1',
        [currentParentId]
      )
    ).rows;

    if (parentRows.length === 0) {
      break;
    }

    currentParentId = parentRows[0].parent_id;
  }

  return false;
}

// ============================================================================
// AI Service Config Routes
// ============================================================================

/**
 * GET /api/ai/services
 * Get all AI service configurations
 */
router.get('/services', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const serviceResult = await query<AIServiceConfig>(
      `SELECT id, service_name, api_key_vault_path, enabled, settings,
              created_at, updated_at, created_by, updated_by
       FROM ai_service_configs
       ORDER BY service_name`
    );

    const services = serviceResult.rows.map((row) => ({
      id: row.id,
      service_name: row.service_name,
      enabled: row.enabled,
      settings: row.settings,
      api_key_configured: !!row.api_key_vault_path,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by,
      updated_by: row.updated_by,
    }));

    return res.json(services);
  } catch (error) {
    logger.error('Failed to fetch AI services', toError(error));
    return res.status(500).json({ error: 'Failed to fetch AI services' });
  }
}));

/**
 * GET /api/ai/services/:serviceName
 * Get specific AI service configuration
 */
router.get('/services/:serviceName', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { serviceName } = req.params;

    if (!validateServiceName(serviceName)) {
      return res.status(400).json({ error: 'Invalid service name' });
    }

    const serviceResult = await query<AIServiceConfig>(
      `SELECT id, service_name, api_key_vault_path, enabled, settings,
              created_at, updated_at, created_by, updated_by
       FROM ai_service_configs
       WHERE service_name = $1`,
      [serviceName.toLowerCase()]
    );

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const service = serviceResult.rows[0];
    return res.json({
      id: service.id,
      service_name: service.service_name,
      enabled: service.enabled,
      settings: service.settings,
      api_key_configured: !!service.api_key_vault_path,
      created_at: service.created_at,
      updated_at: service.updated_at,
      created_by: service.created_by,
      updated_by: service.updated_by,
    });
  } catch (error) {
    logger.error('Failed to fetch AI service', toError(error), { serviceName: req.params.serviceName });
    return res.status(500).json({ error: 'Failed to fetch AI service' });
  }
}));

/**
 * PUT /api/ai/services/:serviceName
 * Update AI service configuration
 */
router.put(
  '/services/:serviceName',
  csrfProtection,
  aiServicesRateLimit as RequestHandler,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { serviceName } = req.params;
      const { api_key, enabled, settings } = req.body as UpdateServiceRequest;
      const userId = req.user!.id;

      if (!validateServiceName(serviceName)) {
        return res.status(400).json({ error: 'Invalid service name' });
      }

      // Check if service exists
      const serviceResult = await query(
        'SELECT id FROM ai_service_configs WHERE service_name = $1',
        [serviceName.toLowerCase()]
      );

      if (serviceResult.rows.length === 0) {
        return res.status(404).json({ error: 'Service not found' });
      }

      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      // Handle API key storage in Vault
      if (api_key !== undefined) {
        const vaultPath = `secret/ai/${serviceName.toLowerCase()}`;
        try {
          await secretsService.storeSecret(vaultPath, api_key);
          updates.push(`api_key_vault_path = $${paramIndex++}`);
          values.push(vaultPath);
          logger.info('API key stored in Vault', { serviceName, vaultPath });
        } catch (error) {
          logger.error('Failed to store API key in Vault', toError(error), { serviceName });
          return res.status(500).json({ error: 'Failed to store API key securely' });
        }
      }

      // Handle enabled flag
      if (enabled !== undefined) {
        updates.push(`enabled = $${paramIndex++}`);
        values.push(enabled);
      }

      // Handle settings
      if (settings !== undefined) {
        updates.push(`settings = $${paramIndex++}`);
        values.push(JSON.stringify(settings));
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }

      // Add updated_at and updated_by
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      updates.push(`updated_by = $${paramIndex++}`);
      values.push(userId);

      // Add WHERE clause
      values.push(serviceName.toLowerCase());

      await query(
        `UPDATE ai_service_configs
         SET ${updates.join(', ')}
         WHERE service_name = $${paramIndex}`,
        values
      );

      await logAudit(userId, 'UPDATE', 'ai_service', serviceName, {
        enabled,
        settings,
        api_key_updated: !!api_key,
      });

      return res.json({ message: 'Service configuration updated successfully' });
    } catch (error) {
      logger.error('Failed to update AI service', toError(error), { serviceName: req.params.serviceName });
      return res.status(500).json({ error: 'Failed to update AI service configuration' });
    }
  })
);

/**
 * POST /api/ai/services/:serviceName/test
 * Test AI service connection
 */
router.post(
  '/services/:serviceName/test',
  csrfProtection,
  aiServicesRateLimit as RequestHandler,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { serviceName } = req.params;
      const userId = req.user!.id;

      if (!validateServiceName(serviceName)) {
        return res.status(400).json({ error: 'Invalid service name' });
      }

      // Check if API key is configured
      const apiKeyResult = await query<{ api_key_vault_path: string | null }>(
        'SELECT api_key_vault_path FROM ai_service_configs WHERE service_name = $1',
        [serviceName.toLowerCase()]
      );

      if (apiKeyResult.rows.length === 0) {
        return res.status(404).json({ error: 'Service not found' });
      }

      const { api_key_vault_path } = apiKeyResult.rows[0];

      if (!api_key_vault_path) {
        await logAudit(userId, 'TEST', 'ai_service', serviceName, { configured: false });
        return res.json({
          configured: false,
          message: 'API key not configured for this service',
        });
      }

      // Retrieve API key from Vault
      try {
        const apiKey = await secretsService.retrieveSecret(api_key_vault_path);
        await logAudit(userId, 'TEST', 'ai_service', serviceName, { configured: true });
        return res.json({
          configured: !!apiKey,
          message: apiKey
            ? 'API key is configured (actual API testing will be implemented in future phase)'
            : 'API key not found in Vault',
        });
      } catch (error) {
        logger.error('Failed to retrieve API key from Vault', toError(error), { serviceName });
        await logAudit(userId, 'TEST', 'ai_service', serviceName, { error: 'vault_retrieval_failed' });
        return res.status(500).json({ error: 'Failed to retrieve API key from Vault' });
      }
    } catch (error) {
      logger.error('Failed to test AI service', toError(error), { serviceName: req.params.serviceName });
      return res.status(500).json({ error: 'Failed to test AI service connection' });
    }
  })
);

// ============================================================================
// Prompt Category Routes
// ============================================================================

/**
 * GET /api/ai/prompts/categories
 * Get all categories with hierarchy
 */
router.get('/prompts/categories', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const categoriesResult = await query<AIPromptCategory>(
      `SELECT id, name, description, parent_id, sort_order,
              created_at, updated_at, created_by, updated_by
       FROM ai_prompt_categories
       ORDER BY sort_order, name`
    );

    const categories = buildCategoryHierarchy(categoriesResult.rows);
    return res.json(categories);
  } catch (error) {
    logger.error('Failed to fetch prompt categories', toError(error));
    return res.status(500).json({ error: 'Failed to fetch prompt categories' });
  }
}));

/**
 * POST /api/ai/prompts/categories
 * Create new category
 */
router.post(
  '/prompts/categories',
  csrfProtection,
  aiPromptsRateLimit as RequestHandler,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    let sanitizedName = '';
    let sanitizedDescription: string | null = null;
    try {
      const { name, description, parent_id, sort_order } = req.body;
      const userId = req.user!.id;

      // Validate name
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Category name is required' });
      }

      if (name.length > 100) {
        return res.status(400).json({ error: 'Category name must be 100 characters or less' });
      }

      // Sanitize inputs
      sanitizedName = stripAllHTML(name.trim());
      sanitizedDescription = description ? stripAllHTML(description.trim()) : null;

      // Check for duplicate name at same level (helps provide better UX in non-race cases)
      // The unique index ensures correctness even if this check is bypassed by concurrent requests
      const duplicateCheck = await query(
        `SELECT id FROM ai_prompt_categories
         WHERE name = $1 AND (parent_id = $2 OR (parent_id IS NULL AND $2 IS NULL))`,
        [sanitizedName, parent_id || null]
      );

      if (duplicateCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Category with this name already exists at this level' });
      }

      // Insert new category
      const insertResult = await query<AIPromptCategory>(
        `INSERT INTO ai_prompt_categories (name, description, parent_id, sort_order, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, description, parent_id, sort_order, created_at, updated_at, created_by, updated_by`,
        [sanitizedName, sanitizedDescription, parent_id || null, sort_order || 0, userId]
      );

      const category = insertResult.rows[0];
      await logAudit(userId, 'CREATE', 'ai_prompt_category', category.id, { name: sanitizedName });

      return res.status(201).json(category);
    } catch (error) {
      const err = toError(error);

      // Check for unique constraint violation (PostgreSQL error code 23505)
      // This handles the race condition where concurrent requests bypass the duplicate check
      if ((error as { code?: string }).code === '23505') {
        logger.warn('Unique constraint violation when creating category', {
          name: sanitizedName,
          message: err.message,
        });
        return res.status(400).json({ error: 'Category with this name already exists at this level' });
      }

      logger.error('Failed to create prompt category', err);
      return res.status(500).json({ error: 'Failed to create prompt category' });
    }
  }
));

/**
 * PUT /api/ai/prompts/categories/:id
 * Update category
 */
router.put(
  '/prompts/categories/:id',
  csrfProtection,
  aiPromptsRateLimit as RequestHandler,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description, parent_id, sort_order } = req.body;
      const userId = req.user!.id;

      // Check if category exists
      const existingCategory = await query(
        'SELECT id FROM ai_prompt_categories WHERE id = $1',
        [id]
      );

      if (existingCategory.rows.length === 0) {
        return res.status(404).json({ error: 'Category not found' });
      }

      // Prevent circular references
      if (parent_id && (await hasCircularReference(id, parent_id))) {
        return res.status(400).json({ error: 'Circular parent reference detected' });
      }

      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        if (typeof name !== 'string' || name.trim().length === 0) {
          return res.status(400).json({ error: 'Category name is required' });
        }
        if (name.length > 100) {
          return res.status(400).json({ error: 'Category name must be 100 characters or less' });
        }
        const sanitizedName = stripAllHTML(name.trim());
        updates.push(`name = $${paramIndex++}`);
        values.push(sanitizedName);
      }

      if (description !== undefined) {
        const sanitizedDescription = description ? stripAllHTML(description.trim()) : null;
        updates.push(`description = $${paramIndex++}`);
        values.push(sanitizedDescription);
      }

      if (parent_id !== undefined) {
        updates.push(`parent_id = $${paramIndex++}`);
        values.push(parent_id || null);
      }

      if (sort_order !== undefined) {
        updates.push(`sort_order = $${paramIndex++}`);
        values.push(sort_order);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      updates.push(`updated_by = $${paramIndex++}`);
      values.push(userId);

      values.push(id);

      await query(
        `UPDATE ai_prompt_categories
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}`,
        values
      );

      await logAudit(userId, 'UPDATE', 'ai_prompt_category', id, { name, parent_id, sort_order });

      return res.json({ message: 'Category updated successfully' });
    } catch (error) {
      logger.error('Failed to update prompt category', toError(error), { categoryId: req.params.id });
      return res.status(500).json({ error: 'Failed to update prompt category' });
    }
  }
));

/**
 * DELETE /api/ai/prompts/categories/:id
 * Delete category
 */
router.delete(
  '/prompts/categories/:id',
  csrfProtection,
  aiPromptsRateLimit as RequestHandler,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // Check if category has children
      const childrenCheck = await query(
        'SELECT COUNT(*) as count FROM ai_prompt_categories WHERE parent_id = $1',
        [id]
      );

      if (parseInt(childrenCheck.rows[0].count) > 0) {
        return res.status(400).json({
          error: 'Cannot delete category with children. Please delete or move child categories first.'
        });
      }

      // Delete category
      const deleteResult = await query<{ id: string }>(
        'DELETE FROM ai_prompt_categories WHERE id = $1 RETURNING id',
        [id]
      );

      if (deleteResult.rows.length === 0) {
        return res.status(404).json({ error: 'Category not found' });
      }

      await logAudit(userId, 'DELETE', 'ai_prompt_category', id);

      return res.json({ message: 'Category deleted successfully' });
    } catch (error) {
      logger.error('Failed to delete prompt category', toError(error), { categoryId: req.params.id });
      return res.status(500).json({ error: 'Failed to delete prompt category' });
    }
  }
));

// ============================================================================
// Prompt Library Routes
// ============================================================================

/**
 * GET /api/ai/prompts
 * Get prompts with pagination and filtering
 */
router.get('/prompts', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const categoryId = req.query.category_id as string | undefined;
    const search = req.query.search as string | undefined;
    const isFavorite = req.query.is_favorite === 'true';
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (categoryId) {
      whereClauses.push(`p.category_id = $${paramIndex++}`);
      values.push(categoryId);
    }

    if (search) {
      whereClauses.push(`to_tsvector('english', p.title || ' ' || p.content) @@ plainto_tsquery('english', $${paramIndex++})`);
      values.push(search);
    }

    if (isFavorite) {
      whereClauses.push(`p.is_favorite = true`);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Get total count
    const countResult = await query<{ total: string }>(
      `SELECT COUNT(*) as total FROM ai_prompts p ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].total);

    // Get prompts
    const promptsResult = await query<AIPrompt>(
      `SELECT p.id, p.title, p.content, p.category_id, p.variables, p.metadata,
              p.is_favorite, p.created_at, p.updated_at, p.created_by, p.updated_by,
              c.name as category_name
       FROM ai_prompts p
       LEFT JOIN ai_prompt_categories c ON p.category_id = c.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...values, limit, offset]
    );

    return res.json({
      prompts: promptsResult.rows,
      total,
      page,
      limit,
    });
  } catch (error) {
    logger.error('Failed to fetch prompts', toError(error));
    return res.status(500).json({ error: 'Failed to fetch prompts' });
  }
}));

/**
 * GET /api/ai/prompts/:id
 * Get specific prompt
 */
router.get('/prompts/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const promptResult = await query<AIPrompt>(
      `SELECT p.id, p.title, p.content, p.category_id, p.variables, p.metadata,
              p.is_favorite, p.created_at, p.updated_at, p.created_by, p.updated_by,
              c.name as category_name, c.description as category_description
       FROM ai_prompts p
       LEFT JOIN ai_prompt_categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [id]
    );

    if (promptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    return res.json(promptResult.rows[0]);
  } catch (error) {
    logger.error('Failed to fetch prompt', toError(error), { promptId: req.params.id });
    return res.status(500).json({ error: 'Failed to fetch prompt' });
  }
}));

/**
 * POST /api/ai/prompts
 * Create new prompt
 */
router.post(
  '/prompts',
  csrfProtection,
  aiPromptsRateLimit as RequestHandler,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { title, content, category_id, variables, metadata, is_favorite } = req.body as CreatePromptRequest;
      const userId = req.user!.id;

      // Validate required fields
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: 'Prompt title is required' });
      }

      if (title.length > 255) {
        return res.status(400).json({ error: 'Prompt title must be 255 characters or less' });
      }

      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ error: 'Prompt content is required' });
      }

      // Sanitize title
      const sanitizedTitle = stripAllHTML(title.trim());

      // Validate variables
      if (variables !== undefined && !Array.isArray(variables)) {
        return res.status(400).json({ error: 'Variables must be an array' });
      }

      // Validate metadata
      if (metadata !== undefined && (typeof metadata !== 'object' || metadata === null)) {
        return res.status(400).json({ error: 'Metadata must be an object' });
      }

      // Insert new prompt
      const insertPromptResult = await query<AIPrompt>(
        `INSERT INTO ai_prompts (title, content, category_id, variables, metadata, is_favorite, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, title, content, category_id, variables, metadata, is_favorite,
                   created_at, updated_at, created_by, updated_by`,
        [
          sanitizedTitle,
          content.trim(),
          category_id || null,
          JSON.stringify(variables || []),
          JSON.stringify(metadata || {}),
          is_favorite || false,
          userId,
        ]
      );

      const prompt = insertPromptResult.rows[0];
      await logAudit(userId, 'CREATE', 'ai_prompt', prompt.id, { title: sanitizedTitle });

      return res.status(201).json(prompt);
    } catch (error) {
      logger.error('Failed to create prompt', toError(error));
      return res.status(500).json({ error: 'Failed to create prompt' });
    }
  }
));

/**
 * PUT /api/ai/prompts/:id
 * Update prompt
 */
router.put(
  '/prompts/:id',
  csrfProtection,
  aiPromptsRateLimit as RequestHandler,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { title, content, category_id, variables, metadata, is_favorite } = req.body as UpdatePromptRequest;
      const userId = req.user!.id;

      // Note: Ownership check is performed atomically in the UPDATE statement below

      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (title !== undefined) {
        if (typeof title !== 'string' || title.trim().length === 0) {
          return res.status(400).json({ error: 'Prompt title is required' });
        }
        if (title.length > 255) {
          return res.status(400).json({ error: 'Prompt title must be 255 characters or less' });
        }
        const sanitizedTitle = stripAllHTML(title.trim());
        updates.push(`title = $${paramIndex++}`);
        values.push(sanitizedTitle);
      }

      if (content !== undefined) {
        if (typeof content !== 'string' || content.trim().length === 0) {
          return res.status(400).json({ error: 'Prompt content is required' });
        }
        updates.push(`content = $${paramIndex++}`);
        values.push(content.trim());
      }

      if (category_id !== undefined) {
        updates.push(`category_id = $${paramIndex++}`);
        values.push(category_id || null);
      }

      if (variables !== undefined) {
        if (!Array.isArray(variables)) {
          return res.status(400).json({ error: 'Variables must be an array' });
        }
        updates.push(`variables = $${paramIndex++}`);
        values.push(JSON.stringify(variables));
      }

      if (metadata !== undefined) {
        if (typeof metadata !== 'object' || metadata === null) {
          return res.status(400).json({ error: 'Metadata must be an object' });
        }
        updates.push(`metadata = $${paramIndex++}`);
        values.push(JSON.stringify(metadata));
      }

      if (is_favorite !== undefined) {
        updates.push(`is_favorite = $${paramIndex++}`);
        values.push(is_favorite);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      updates.push(`updated_by = $${paramIndex++}`);
      values.push(userId);

      values.push(id);
      values.push(userId);

      // Atomic ownership check with UPDATE to prevent TOCTOU
      const result = await query(
        `UPDATE ai_prompts
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex} AND created_by = $${paramIndex + 1}
         RETURNING id`,
        values
      );

      // Distinguish between not found (404) and not owned (403)
      if (result.rows.length === 0) {
        // Check if prompt exists at all
        const existsCheck = await query(
          'SELECT id FROM ai_prompts WHERE id = $1',
          [id]
        );
        if (existsCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Prompt not found' });
        }
        return res.status(403).json({ error: 'You do not have permission to update this prompt' });
      }

      await logAudit(userId, 'UPDATE', 'ai_prompt', id, { title });

      return res.json({ message: 'Prompt updated successfully' });
    } catch (error) {
      logger.error('Failed to update prompt', toError(error), { promptId: req.params.id });
      return res.status(500).json({ error: 'Failed to update prompt' });
    }
  }
));

/**
 * DELETE /api/ai/prompts/:id
 * Delete prompt
 */
router.delete(
  '/prompts/:id',
  csrfProtection,
  aiPromptsRateLimit as RequestHandler,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // Delete prompt (only if user owns it)
      const deletePromptResult = await query<{ id: string }>(
        'DELETE FROM ai_prompts WHERE id = $1 AND created_by = $2 RETURNING id',
        [id, userId]
      );

      if (deletePromptResult.rows.length === 0) {
        return res.status(404).json({ error: 'Prompt not found or you do not have permission to delete it' });
      }

      await logAudit(userId, 'DELETE', 'ai_prompt', id);

      return res.json({ message: 'Prompt deleted successfully' });
    } catch (error) {
      logger.error('Failed to delete prompt', toError(error), { promptId: req.params.id });
      return res.status(500).json({ error: 'Failed to delete prompt' });
    }
  }
));

export default router;
