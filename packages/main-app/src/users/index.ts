import { Router, Response } from 'express';
import { query } from '../db';
import { hashPassword, validateEmail } from '@monorepo/shared';
import { Role, Capability } from '@monorepo/shared';
import { AuthenticatedRequest, authMiddleware } from '../auth';
import { requireRole, requireCapability } from '../auth/rbac-middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/users - List users with pagination and search
router.get('/', requireCapability(Capability.USER_VIEW), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '10',
      search = '',
      role = '',
      active = '',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      whereClause += ` AND (email ILIKE $${paramCount} OR username ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (role) {
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
    const total = parseInt(countResult.rows[0].count);

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

    res.json({
      users: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('[Users] List error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch users',
    });
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', requireCapability(Capability.USER_VIEW), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
    console.error('[Users] Get error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch user',
    });
  }
});

// POST /api/users - Create new user (admin only)
router.post('/', requireRole(Role.ADMIN), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, username, password, role = 'viewer' } = req.body;

    // Validate input
    if (!email || !username || !password) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Email, username, and password are required',
      });
      return;
    }

    // Validate email format
    if (!validateEmail(email)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid email format',
      });
      return;
    }

    if (!Object.values(Role).includes(role as Role)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid role',
      });
      return;
    }

    // Hash password
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
    console.error('[Users] Create error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create user',
    });
  }
});

// PATCH /api/users/:id - Update user (admin only)
router.patch('/:id', requireRole(Role.ADMIN), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { email, username, role, is_active } = req.body;

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramCount = 0;

    if (email !== undefined) {
      // Validate email format if provided
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

    paramCount++;
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

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
    console.error('[Users] Update error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update user',
    });
  }
});

// DELETE /api/users/:id - Delete user (admin only)
router.delete('/:id', requireRole(Role.ADMIN), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
    console.error('[Users] Delete error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete user',
    });
  }
});

export { router as usersRouter };
