import { Router, Response } from 'express';
import { query, transaction } from '../db';
import { hashPassword, validateEmail, createLogger, LogLevel } from '@monorepo/shared';
import { Role } from '@monorepo/shared';
import { AuthenticatedRequest, authMiddleware } from '../auth';
import { requireRole } from '../auth/rbac-middleware';
import { Sentry, isSentryEnabled } from '../instrument';
import { csrfProtection, attachCSRFToken } from '../middleware/csrf';

const logger = createLogger({
  level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
  service: 'main-app',
  format: (process.env.LOG_FORMAT as 'json' | 'text') || 'text',
});

const router = Router();

/**
 * Escape special characters in LIKE patterns to prevent SQL injection
 * Escapes: % (wildcard), _ (single char), \ (escape char itself)
 */
function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&');
}

/**
 * Validate UUID format
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(requireRole(Role.ADMIN));
router.use(attachCSRFToken); // Attach CSRF token to responses

// Validate UUID format for :id parameter across all routes
// eslint-disable-next-line @typescript-eslint/no-unused-vars
router.param('id', (_req, res, next, id) => {
  if (!isValidUUID(id)) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid user ID format'
    });
    return;
  }
  next();
});

// GET /api/users-manager - List users with pagination, filtering, sorting
router.get(
  '/',
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const {
        page = '1',
        limit = '10',
        search = '',
        role = '',
        isActive = '',
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      // Validate and sanitize pagination parameters
      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 10));
      const offset = (pageNum - 1) * limitNum;

      // Validate sortBy to prevent SQL injection
      const allowedSortFields = ['username', 'email', 'role', 'createdAt', 'lastLogin'];
      const sortField = allowedSortFields.includes(String(sortBy)) ? String(sortBy) : 'createdAt';

      // Map camelCase to snake_case for database columns
      const sortFieldMap: Record<string, string> = {
        username: 'username',
        email: 'email',
        role: 'role',
        createdAt: 'created_at',
        lastLogin: 'last_login',
      };
      const dbSortField = sortFieldMap[sortField];

      // Validate sort order
      const order = String(sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      let whereClause = 'WHERE 1=1';
      const params: unknown[] = [];
      let paramCount = 0;

      // Search filter - searches both email and username
      if (search) {
        paramCount++;
        whereClause += ` AND (email ILIKE $${paramCount} ESCAPE '\\' OR username ILIKE $${paramCount} ESCAPE '\\')`;
        params.push(`%${escapeLikePattern(String(search))}%`);
      }

      // Role filter
      if (role) {
        // Validate role is a known enum value
        const validRoles = Object.values(Role);
        if (!validRoles.includes(role as Role)) {
          res.status(400).json({ error: 'Invalid role parameter' });
          return;
        }
        paramCount++;
        whereClause += ` AND role = $${paramCount}`;
        params.push(role);
      }

      // Active status filter
      if (isActive) {
        paramCount++;
        whereClause += ` AND is_active = $${paramCount}`;
        params.push(isActive === 'true');
      }

      // Get total count
      const countResult = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM users ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // Get users with sorting
      const result = await query<{
        id: string;
        email: string;
        username: string;
        role: string;
        created_at: Date;
        updated_at: Date;
        last_login: Date;
        is_active: boolean;
      }>(
        `SELECT id, email, username, role, created_at, updated_at, last_login, is_active
       FROM users
       ${whereClause}
       ORDER BY ${dbSortField} ${order}
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
        [...params, limitNum, offset]
      );

      const totalPages = limitNum > 0 ? Math.ceil(total / limitNum) : 0;

      // Map to camelCase for frontend
      const users = result.rows.map((user) => ({
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        createdAt: user.created_at.toISOString(),
        updatedAt: user.updated_at.toISOString(),
        lastLogin: user.last_login ? user.last_login.toISOString() : undefined,
        active: user.is_active,
      }));

      res.json({
        users,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      });
    } catch (error) {
      logger.error('List users error', error as Error);
      if (isSentryEnabled) {
        Sentry.captureException(error as Error);
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch users',
      });
    }
  }
);

// GET /api/users-manager/:id - Get single user by ID
router.get(
  '/:id',
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const result = await query<{
        id: string;
        email: string;
        username: string;
        role: string;
        created_at: Date;
        updated_at: Date;
        last_login: Date;
        is_active: boolean;
      }>(
        `SELECT id, email, username, role, created_at, updated_at, last_login, is_active
       FROM users
       WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          error: 'Not Found',
          message: 'User not found',
        });
        return;
      }

      const user = result.rows[0];
      res.json({
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        createdAt: user.created_at.toISOString(),
        updatedAt: user.updated_at.toISOString(),
        lastLogin: user.last_login ? user.last_login.toISOString() : undefined,
        active: user.is_active,
      });
    } catch (error) {
      logger.error('Get user error', error as Error);
      if (isSentryEnabled) {
        Sentry.captureException(error as Error);
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch user',
      });
    }
  }
);

// POST /api/users-manager - Create new user
router.post(
  '/',
  csrfProtection,
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const body = req.body as { email?: unknown; username?: unknown; password?: unknown; role?: unknown; active?: unknown };
      const email = body.email;
      const username = body.username;
      const password = body.password;
      const role = body.role || Role.VIEWER;
      const active = body.active !== undefined ? body.active : true;

      // Validate input
      if (!email || !username || !password) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Email, username, and password are required',
        });
        return;
      }

      // Validate username format (alphanumeric, hyphens, underscores, 3-30 chars)
      const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
      if (typeof username !== 'string' || !usernameRegex.test(username)) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Username must be 3-30 characters and contain only letters, numbers, hyphens, and underscores',
        });
        return;
      }

      // Validate email format
      if (typeof email !== 'string' || !validateEmail(email)) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid email format',
        });
        return;
      }

      if (typeof role !== 'string' || !Object.values(Role).includes(role as Role)) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid role',
        });
        return;
      }

      // Hash password
      if (typeof password !== 'string') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Password must be a string',
        });
        return;
      }
      const password_hash = await hashPassword(password);

      // Create user
      const result = await query<{
        id: string;
        email: string;
        username: string;
        role: string;
        created_at: Date;
        is_active: boolean;
      }>(
        `INSERT INTO users (email, username, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, username, role, created_at, is_active`,
        [email, username, password_hash, role, active]
      );

      // Audit log
      logger.info('User created', {
        actorId: req.user?.userId,
        targetUserId: result.rows[0].id,
        email: result.rows[0].email,
        role: result.rows[0].role,
      });

      const user = result.rows[0];
      res.status(201).json({
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        createdAt: user.created_at.toISOString(),
        active: user.is_active,
      });
    } catch (error: unknown) {
      const err = error as { code?: string; constraint?: string };
      if (err.code === '23505') {
        res.status(409).json({
          error: 'Conflict',
          message: err.constraint?.includes('email')
            ? 'Email already exists'
            : 'Username already exists',
        });
        return;
      }
      logger.error('Create user error', error as Error);
      if (isSentryEnabled) {
        Sentry.captureException(error as Error);
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create user',
      });
    }
  }
);

// PATCH /api/users-manager/:id - Update user
router.patch(
  '/:id',
  csrfProtection,
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const body = req.body as { email?: unknown; username?: unknown; password?: unknown; role?: unknown; active?: unknown };
      const email = body.email;
      const username = body.username;
      const password = body.password;
      const role = body.role;
      const active = body.active;

      const updates: string[] = [];
      const params: unknown[] = [];
      let paramCount = 0;

      if (email !== undefined) {
        // Validate email format if provided
        if (typeof email !== 'string' || !validateEmail(email)) {
          res.status(400).json({
            error: 'Bad Request',
            message: 'Invalid email format',
          });
          return;
        }
        paramCount++;
        updates.push(`email = $${paramCount}`);
        params.push(email);
      }

      if (username !== undefined) {
        // Validate username format (alphanumeric, hyphens, underscores, 3-30 chars)
        const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
        if (typeof username !== 'string' || !usernameRegex.test(username)) {
          res.status(400).json({
            error: 'Bad Request',
            message: 'Username must be 3-30 characters and contain only letters, numbers, hyphens, and underscores',
          });
          return;
        }
        paramCount++;
        updates.push(`username = $${paramCount}`);
        params.push(username);
      }

      if (password !== undefined) {
        // Hash new password
        if (typeof password !== 'string') {
          res.status(400).json({
            error: 'Bad Request',
            message: 'Password must be a string',
          });
          return;
        }
        const password_hash = await hashPassword(password);
        paramCount++;
        updates.push(`password_hash = $${paramCount}`);
        params.push(password_hash);
      }

      if (role !== undefined) {
        if (!Object.values(Role).includes(role as Role)) {
          res.status(400).json({
            error: 'Bad Request',
            message: 'Invalid role',
          });
          return;
        }
        paramCount++;
        updates.push(`role = $${paramCount}`);
        params.push(role);
      }

      if (active !== undefined) {
        // Validate active is a boolean
        if (typeof active !== 'boolean') {
          res.status(400).json({
            error: 'Bad Request',
            message: 'active must be a boolean',
          });
          return;
        }
        paramCount++;
        updates.push(`is_active = $${paramCount}`);
        params.push(active);
      }

      if (updates.length === 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'No fields to update',
        });
        return;
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      paramCount++;
      params.push(id);

      const result = await query<{
        id: string;
        email: string;
        username: string;
        role: string;
        is_active: boolean;
        updated_at: Date;
      }>(
        `UPDATE users
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, email, username, role, is_active, updated_at`,
        params
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          error: 'Not Found',
          message: 'User not found',
        });
        return;
      }

      logger.info('User updated', {
        actorId: req.user?.userId,
        targetUserId: id,
      });

      const user = result.rows[0];
      res.json({
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        active: user.is_active,
        updatedAt: user.updated_at.toISOString(),
      });
    } catch (error: unknown) {
      const err = error as { code?: string; constraint?: string };
      if (err.code === '23505') {
        res.status(409).json({
          error: 'Conflict',
          message: err.constraint?.includes('email')
            ? 'Email already exists'
            : 'Username already exists',
        });
        return;
      }
      logger.error('Update user error', error as Error);
      if (isSentryEnabled) {
        Sentry.captureException(error as Error);
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update user',
      });
    }
  }
);

// DELETE /api/users-manager/:id - Delete user
router.delete(
  '/:id',
  csrfProtection,
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const actorId = req.user?.userId;

      // Prevent self-deletion
      if (actorId === id) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Cannot delete your own account',
        });
        return;
      }

      // Check if trying to delete user with username 'kevin'
      const checkResult = await query<{ username: string }>(
        'SELECT username FROM users WHERE id = $1',
        [id]
      );

      if (checkResult.rows.length === 0) {
        res.status(404).json({
          error: 'Not Found',
          message: 'User not found',
        });
        return;
      }

      if (checkResult.rows[0].username === 'kevin') {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Cannot delete the kevin account',
        });
        return;
      }

      // Delete user
      const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

      if (result.rows.length === 0) {
        res.status(404).json({
          error: 'Not Found',
          message: 'User not found',
        });
        return;
      }

      logger.info('User deleted', {
        actorId: req.user?.userId,
        targetUserId: id,
      });

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      logger.error('Delete user error', error as Error);
      if (isSentryEnabled) {
        Sentry.captureException(error as Error);
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete user',
      });
    }
  }
);

// GET /api/users-manager/:id/activity - Get user activity log
router.get(
  '/:id/activity',
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { limit = '50' } = req.query;

      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));

      // Check if audit_logs table exists, if not return empty array
      const tableCheck = await query<{ exists: boolean }>(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'audit_logs'
        )`,
        []
      );

      if (!tableCheck.rows[0].exists) {
        res.json({ activities: [] });
        return;
      }

      const result = await query<{
        id: string;
        action: string;
        details: string;
        created_at: Date;
        actor_id: string;
      }>(
        `SELECT id, action, details, created_at, actor_id
       FROM audit_logs
       WHERE target_user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
        [id, limitNum]
      );

      const activities = result.rows.map((row) => ({
        id: row.id,
        userId: id,
        action: row.action,
        details: row.details,
        timestamp: row.created_at.toISOString(),
      }));

      res.json({ activities });
    } catch (error) {
      logger.error('Get user activity error', error as Error);
      if (isSentryEnabled) {
        Sentry.captureException(error as Error);
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch user activity',
      });
    }
  }
);

// GET /api/users-manager/:id/custom-fields - Get custom fields
router.get(
  '/:id/custom-fields',
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Check if custom_fields column exists
      const columnCheck = await query<{ exists: boolean }>(
        `SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'custom_fields'
        )`,
        []
      );

      if (!columnCheck.rows[0].exists) {
        res.json({ customFields: {} });
        return;
      }

      const result = await query<{ custom_fields: Record<string, unknown> | null }>(
        'SELECT custom_fields FROM users WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          error: 'Not Found',
          message: 'User not found',
        });
        return;
      }

      res.json({ customFields: result.rows[0].custom_fields || {} });
    } catch (error) {
      logger.error('Get custom fields error', error as Error);
      if (isSentryEnabled) {
        Sentry.captureException(error as Error);
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch custom fields',
      });
    }
  }
);

// PATCH /api/users-manager/:id/custom-fields - Update custom fields
router.patch(
  '/:id/custom-fields',
  csrfProtection,
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const body = req.body as { customFields?: unknown };
      const customFields = body.customFields;

      if (!customFields || typeof customFields !== 'object') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'customFields must be an object',
        });
        return;
      }

      // Check if custom_fields column exists
      const columnCheck = await query<{ exists: boolean }>(
        `SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'custom_fields'
        )`,
        []
      );

      if (!columnCheck.rows[0].exists) {
        res.status(501).json({
          error: 'Not Implemented',
          message: 'Custom fields feature not available',
        });
        return;
      }

      const result = await query<{ custom_fields: Record<string, unknown> }>(
        'UPDATE users SET custom_fields = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING custom_fields',
        [JSON.stringify(customFields), id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          error: 'Not Found',
          message: 'User not found',
        });
        return;
      }

      res.json({ customFields: result.rows[0].custom_fields });
    } catch (error) {
      logger.error('Update custom fields error', error as Error);
      if (isSentryEnabled) {
        Sentry.captureException(error as Error);
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update custom fields',
      });
    }
  }
);

// POST /api/users-manager/bulk/import - Bulk import users
router.post(
  '/bulk/import',
  csrfProtection,
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const body = req.body as { users?: unknown };
      const users = body.users;

      if (!Array.isArray(users) || users.length === 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'users must be a non-empty array',
        });
        return;
      }

      const results: { success: number; failed: number; errors: Array<{ index: number; error: string }> } = {
        success: 0,
        failed: 0,
        errors: [],
      };

      // Wrap the entire import in a transaction for atomicity
      await transaction(async (client) => {
        for (let i = 0; i < users.length; i++) {
          const user = users[i] as { email?: unknown; username?: unknown; password?: unknown; role?: unknown; active?: unknown };
          try {
            // Validate user data
            if (!user.email || !user.username || !user.password) {
              results.failed++;
              results.errors.push({
                index: i,
                error: 'Missing required fields: email, username, or password',
              });
              continue;
            }

            // Validate email
            if (typeof user.email !== 'string' || !validateEmail(user.email)) {
              results.failed++;
              results.errors.push({
                index: i,
                error: 'Invalid email format',
              });
              continue;
            }

            // Validate username
            const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
            if (typeof user.username !== 'string' || !usernameRegex.test(user.username)) {
              results.failed++;
              results.errors.push({
                index: i,
                error: 'Invalid username format',
              });
              continue;
            }

            // Validate role
            const role = user.role || Role.VIEWER;
            if (typeof role !== 'string' || !Object.values(Role).includes(role as Role)) {
              results.failed++;
              results.errors.push({
                index: i,
                error: 'Invalid role',
              });
              continue;
            }

            // Validate password
            if (typeof user.password !== 'string') {
              results.failed++;
              results.errors.push({
                index: i,
                error: 'Password must be a string',
              });
              continue;
            }

            // Hash password
            const password_hash = await hashPassword(user.password);
            const active = user.active !== undefined ? user.active : true;

            // Insert user using transaction client
            await client.query(
              `INSERT INTO users (email, username, password_hash, role, is_active)
             VALUES ($1, $2, $3, $4, $5)`,
              [user.email, user.username, password_hash, role, active]
            );

            results.success++;
          } catch (error: unknown) {
            const err = error as { code?: string; constraint?: string };
            results.failed++;

            let errorMessage = 'Failed to create user';
            if (err.code === '23505') {
              errorMessage = err.constraint?.includes('email')
                ? 'Email already exists'
                : 'Username already exists';
            }

            results.errors.push({
              index: i,
              error: errorMessage,
            });
          }
        }
      });

      logger.info('Bulk import completed', {
        actorId: req.user?.userId,
        success: results.success,
        failed: results.failed,
      });

      res.json(results);
    } catch (error) {
      logger.error('Bulk import error', error as Error);
      if (isSentryEnabled) {
        Sentry.captureException(error as Error);
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to import users',
      });
    }
  }
);

// POST /api/users-manager/bulk/export - Bulk export users
router.post(
  '/bulk/export',
  csrfProtection,
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const body = req.body as { format?: unknown; userIds?: unknown };
      const format = body.format || 'json';
      const userIds = body.userIds;

      if (format !== 'csv' && format !== 'json') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'format must be either "csv" or "json"',
        });
        return;
      }

      let query_text = 'SELECT id, email, username, role, is_active, created_at, updated_at, last_login FROM users';
      const params: unknown[] = [];

      if (Array.isArray(userIds) && userIds.length > 0) {
        query_text += ' WHERE id = ANY($1)';
        params.push(userIds);
      }

      query_text += ' ORDER BY created_at DESC';

      const result = await query<{
        id: string;
        email: string;
        username: string;
        role: string;
        is_active: boolean;
        created_at: Date;
        updated_at: Date;
        last_login: Date;
      }>(query_text, params);

      if (format === 'json') {
        const users = result.rows.map((user) => ({
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          active: user.is_active,
          createdAt: user.created_at.toISOString(),
          updatedAt: user.updated_at.toISOString(),
          lastLogin: user.last_login ? user.last_login.toISOString() : null,
        }));

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=users.json');
        res.json(users);
      } else {
        // CSV format
        const headers = ['id', 'email', 'username', 'role', 'active', 'createdAt', 'updatedAt', 'lastLogin'];
        const csvRows = [headers.join(',')];

        for (const user of result.rows) {
          const row = [
            user.id,
            user.email,
            user.username,
            user.role,
            String(user.is_active),
            user.created_at.toISOString(),
            user.updated_at.toISOString(),
            user.last_login ? user.last_login.toISOString() : '',
          ];
          csvRows.push(row.join(','));
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
        res.send(csvRows.join('\n'));
      }

      logger.info('Bulk export completed', {
        actorId: req.user?.userId,
        format,
        count: result.rows.length,
      });
    } catch (error) {
      logger.error('Bulk export error', error as Error);
      if (isSentryEnabled) {
        Sentry.captureException(error as Error);
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to export users',
      });
    }
  }
);

// POST /api/users-manager/bulk/delete - Bulk delete users
router.post(
  '/bulk/delete',
  csrfProtection,
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const body = req.body as { userIds?: unknown };
      const userIds = body.userIds;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'userIds must be a non-empty array',
        });
        return;
      }

      const actorId = req.user?.userId;

      // Prevent self-deletion
      if (actorId && userIds.includes(actorId)) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Cannot delete your own account',
        });
        return;
      }

      // Check for 'kevin' user
      const checkResult = await query<{ id: string; username: string }>(
        'SELECT id, username FROM users WHERE id = ANY($1) AND username = $2',
        [userIds, 'kevin']
      );

      if (checkResult.rows.length > 0) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Cannot delete the kevin account',
        });
        return;
      }

      // Delete users
      const result = await query(
        'DELETE FROM users WHERE id = ANY($1) RETURNING id',
        [userIds]
      );

      logger.info('Bulk delete completed', {
        actorId: req.user?.userId,
        deleted: result.rowCount,
      });

      res.json({ deleted: result.rowCount || 0 });
    } catch (error) {
      logger.error('Bulk delete error', error as Error);
      if (isSentryEnabled) {
        Sentry.captureException(error as Error);
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete users',
      });
    }
  }
);

export { router as usersManagerRouter };
