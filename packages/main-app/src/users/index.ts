import { Router, Response } from 'express';
import { query } from '../db';
import { hashPassword, validateEmail, createLogger, LogLevel } from '@monorepo/shared';
import { Role, Capability } from '@monorepo/shared';
import { AuthenticatedRequest, authMiddleware } from '../auth';
import { requireRole, requireCapability } from '../auth/rbac-middleware';

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

// All routes require authentication
router.use(authMiddleware);

// GET /api/users - List users with pagination and search
router.get(
  '/',
  requireCapability(Capability.USER_VIEW),
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const {
        page = '1',
        limit = '10',
        search = '',
        email = '',
        username = '',
        role = '',
        active = '',
      } = req.query;

      // Validate and sanitize pagination parameters
      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 10));
      const offset = (pageNum - 1) * limitNum;

      let whereClause = 'WHERE 1=1';
      const params: unknown[] = [];
      let paramCount = 0;

      // Support both legacy 'search' parameter and specific 'email'/'username' parameters
      // If email or username specified, they take precedence over search
      if (email) {
        paramCount++;
        whereClause += ` AND email ILIKE $${paramCount} ESCAPE '\\'`;
        params.push(`%${escapeLikePattern(String(email))}%`);
      }

      if (username) {
        paramCount++;
        whereClause += ` AND username ILIKE $${paramCount} ESCAPE '\\'`;
        params.push(`%${escapeLikePattern(String(username))}%`);
      }

      // Legacy search parameter - searches both email and username if no specific params given
      if (search && !email && !username) {
        paramCount++;
        whereClause += ` AND (email ILIKE $${paramCount} ESCAPE '\\' OR username ILIKE $${paramCount} ESCAPE '\\')`;
        params.push(`%${escapeLikePattern(String(search))}%`);
      }

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

      if (active) {
        paramCount++;
        whereClause += ` AND is_active = $${paramCount}`;
        params.push(active === 'true');
      }

      // Get total count
      const countResult = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM users ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // Get users
      const result = await query<{
        id: string;
        email: string;
        username: string;
        role: string;
        created_at: Date;
        last_login: Date;
        is_active: boolean;
      }>(
        `SELECT id, email, username, role, created_at, last_login, is_active
       FROM users
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
        [...params, limitNum, offset]
      );

      const totalPages = limitNum > 0 ? Math.ceil(total / limitNum) : 0;

      res.json({
        users: result.rows,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
        },
      });
    } catch (error) {
      logger.error('List users error', error as Error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch users',
      });
    }
  }
);

// GET /api/users/:id - Get user by ID
router.get(
  '/:id',
  requireCapability(Capability.USER_VIEW),
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
        last_login: Date;
        is_active: boolean;
      }>(
        `SELECT id, email, username, role, created_at, last_login, is_active
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

      res.json({ user: result.rows[0] });
    } catch (error) {
      logger.error('Get user error', error as Error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch user',
      });
    }
  }
);

// POST /api/users - Create new user (admin only)
router.post(
  '/',
  requireRole(Role.ADMIN),
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { email, username, password, role = Role.VIEWER } = req.body;

      // Validate input
      if (!email || !username || !password) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Email, username, and password are required',
        });
        return;
      }

      // Validate username format (alphanumeric, dots, hyphens, underscores, 3-30 chars)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const usernameRegex = /^[a-zA-Z0-9._-]{3,30}$/;
      if (!usernameRegex.test(username)) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Username must be 3-30 characters and contain only letters, numbers, dots, hyphens, and underscores',
        });
        return;
      }

      // Validate email format
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      if (!validateEmail(email)) {
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const password_hash = await hashPassword(password);

      // Create user
      const result = await query<{
        id: string;
        email: string;
        username: string;
        role: string;
        created_at: Date;
      }>(
        `INSERT INTO users (email, username, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, username, role, created_at`,
        [email, username, password_hash, role]
      );

      // Audit log
      logger.info('User created', {
        actorId: req.user?.userId,
        targetUserId: result.rows[0].id,
        email: result.rows[0].email,
        role: result.rows[0].role,
      });

      res.status(201).json({
        message: 'User created successfully',
        user: result.rows[0],
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
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create user',
      });
    }
  }
);

// PATCH /api/users/:id - Update user (admin only)
router.patch(
  '/:id',
  requireRole(Role.ADMIN),
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { email, username, role, is_active } = req.body;

      const updates: string[] = [];
      const params: unknown[] = [];
      let paramCount = 0;

      if (email !== undefined) {
        // Validate email format if provided
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        if (!validateEmail(email)) {
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
        // Validate username format (alphanumeric, dots, hyphens, underscores, 3-30 chars)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const usernameRegex = /^[a-zA-Z0-9._-]{3,30}$/;
        if (!usernameRegex.test(username)) {
          res.status(400).json({
            error: 'Bad Request',
            message: 'Username must be 3-30 characters and contain only letters, numbers, dots, hyphens, and underscores',
          });
          return;
        }
        paramCount++;
        updates.push(`username = $${paramCount}`);
        params.push(username);
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

      if (is_active !== undefined) {
        // Validate is_active is a boolean or can be coerced to boolean
        if (typeof is_active !== 'boolean') {
          res.status(400).json({
            error: 'Bad Request',
            message: 'is_active must be a boolean',
          });
          return;
        }
        paramCount++;
        updates.push(`is_active = $${paramCount}`);
        params.push(is_active);
      }

      if (updates.length === 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'No fields to update',
        });
        return;
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(id);
      paramCount++;

      const result = await query<{
        id: string;
        email: string;
        username: string;
        role: string;
        is_active: boolean;
      }>(
        `UPDATE users
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, email, username, role, is_active`,
        params
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          error: 'Not Found',
          message: 'User not found',
        });
        return;
      }

      res.json({
        message: 'User updated successfully',
        user: result.rows[0],
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
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update user',
      });
    }
  }
);

// DELETE /api/users/:id - Delete user (admin only)
router.delete(
  '/:id',
  requireRole(Role.ADMIN),
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Prevent self-deletion
      if (req.user?.userId === id) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Cannot delete your own account',
        });
        return;
      }

      const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

      if (result.rows.length === 0) {
        res.status(404).json({
          error: 'Not Found',
          message: 'User not found',
        });
        return;
      }

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      logger.error('Delete user error', error as Error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete user',
      });
    }
  }
);

export { router as usersRouter };
