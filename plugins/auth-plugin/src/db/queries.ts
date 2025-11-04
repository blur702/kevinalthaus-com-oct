import { Pool } from 'pg';

export interface User {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  role: string;
  created_at: Date;
  updated_at: Date;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  created_at: Date;
}

export interface CreateUserParams {
  email: string;
  username: string;
  password_hash: string;
  role?: string;
}

export interface CreateRefreshTokenParams {
  user_id: string;
  token: string;
  expires_at: Date;
}

/**
 * User queries
 */
export class UserQueries {
  constructor(private pool: Pool) {}

  async createUser(params: CreateUserParams): Promise<User> {
    const { email, username, password_hash, role = 'viewer' } = params;
    const result = await this.pool.query<User>(
      `INSERT INTO users (email, username, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [email, username, password_hash, role]
    );
    return result.rows[0];
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const result = await this.pool.query<User>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  async findUserById(id: string): Promise<User | null> {
    const result = await this.pool.query<User>(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findUserByUsername(username: string): Promise<User | null> {
    const result = await this.pool.query<User>(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    return result.rows[0] || null;
  }

  async updateUserRole(userId: string, role: string): Promise<User> {
    const result = await this.pool.query<User>(
      'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [role, userId]
    );
    return result.rows[0];
  }

  async deleteUser(userId: string): Promise<void> {
    await this.pool.query('DELETE FROM users WHERE id = $1', [userId]);
  }
}

/**
 * Refresh token queries
 */
export class RefreshTokenQueries {
  constructor(private pool: Pool) {}

  async createRefreshToken(params: CreateRefreshTokenParams): Promise<RefreshToken> {
    const { user_id, token, expires_at } = params;
    const result = await this.pool.query<RefreshToken>(
      `INSERT INTO refresh_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [user_id, token, expires_at]
    );
    return result.rows[0];
  }

  async findRefreshToken(token: string): Promise<RefreshToken | null> {
    const result = await this.pool.query<RefreshToken>(
      'SELECT * FROM refresh_tokens WHERE token = $1',
      [token]
    );
    return result.rows[0] || null;
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await this.pool.query('DELETE FROM refresh_tokens WHERE token = $1', [token]);
  }

  async deleteUserRefreshTokens(userId: string): Promise<void> {
    await this.pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
  }

  async deleteExpiredTokens(): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP'
    );
    return result.rowCount || 0;
  }

  async findUserRefreshTokens(userId: string): Promise<RefreshToken[]> {
    const result = await this.pool.query<RefreshToken>(
      'SELECT * FROM refresh_tokens WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }
}
