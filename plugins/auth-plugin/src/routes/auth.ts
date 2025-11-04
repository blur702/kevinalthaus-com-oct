import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { UserQueries, RefreshTokenQueries } from '../db/queries';
import { hashPassword, comparePassword } from '../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  getRefreshTokenExpiration
} from '../utils/jwt';
import { authenticateToken } from '../middleware/auth';

export function createAuthRouter(pool: Pool): Router {
  const router = Router();
  const userQueries = new UserQueries(pool);
  const refreshTokenQueries = new RefreshTokenQueries(pool);

  /**
   * POST /api/auth/register
   * Register a new user
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/register', async (req: Request, res: Response): Promise<void> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { email, username, password, role = 'viewer' } = req.body;

      // Validate input
      if (!email || !username || !password) {
        res.status(400).json({ error: 'Email, username, and password are required' });
        return;
      }

      // Check if user already exists
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const existingUserByEmail = await userQueries.findUserByEmail(email);
      if (existingUserByEmail) {
        res.status(409).json({ error: 'Email already registered' });
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const existingUserByUsername = await userQueries.findUserByUsername(username);
      if (existingUserByUsername) {
        res.status(409).json({ error: 'Username already taken' });
        return;
      }

      // Hash password
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const password_hash = await hashPassword(password);

      // Create user
      const user = await userQueries.createUser({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        email,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        username,
        password_hash,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        role
      });

      res.status(201).json({
        message: 'User registered successfully',
        userId: user.id
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to register user',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/auth/login
   * Authenticate user and return tokens
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/login', async (req: Request, res: Response): Promise<void> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      // Find user
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const user = await userQueries.findUserByEmail(email);
      if (!user) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      // Verify password
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const isValidPassword = await comparePassword(password, user.password_hash);
      if (!isValidPassword) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      // Generate tokens
      const payload = {
        userId: user.id,
        email: user.email,
        role: user.role
      };

      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);

      // Store refresh token in database
      await refreshTokenQueries.createRefreshToken({
        user_id: user.id,
        token: refreshToken,
        expires_at: getRefreshTokenExpiration()
      });

      res.json({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role
        }
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to login',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/auth/refresh
   * Refresh access token using refresh token
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({ error: 'Refresh token is required' });
        return;
      }

      // Verify refresh token exists in database
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const storedToken = await refreshTokenQueries.findRefreshToken(refreshToken);
      if (!storedToken) {
        res.status(403).json({ error: 'Invalid refresh token' });
        return;
      }

      // Check if token is expired
      if (new Date(storedToken.expires_at) < new Date()) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        await refreshTokenQueries.deleteRefreshToken(refreshToken);
        res.status(403).json({ error: 'Refresh token has expired' });
        return;
      }

      // Verify and decode token
      let decoded;
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        decoded = verifyToken(refreshToken);
      } catch {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        await refreshTokenQueries.deleteRefreshToken(refreshToken);
        res.status(403).json({ error: 'Invalid refresh token' });
        return;
      }

      // Get user from database to ensure they still exist
      const user = await userQueries.findUserById(decoded.userId);
      if (!user) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        await refreshTokenQueries.deleteRefreshToken(refreshToken);
        res.status(403).json({ error: 'User not found' });
        return;
      }

      // Generate new access token
      const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role
      });

      res.json({ accessToken });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to refresh token',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/auth/logout
   * Logout user and revoke refresh token
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/logout', authenticateToken, async (req: Request, res: Response): Promise<void> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({ error: 'Refresh token is required' });
        return;
      }

      // Delete refresh token from database
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await refreshTokenQueries.deleteRefreshToken(refreshToken);

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to logout',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/auth/me
   * Get current authenticated user information
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/me', authenticateToken, async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const user = await userQueries.findUserById(req.user.id);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        created_at: user.created_at
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get user information',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}
