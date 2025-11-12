import { Pool } from 'pg';
import type { PluginLogger } from '@monorepo/shared';
import type {
  Comment,
  CreateCommentInput,
  UpdateCommentInput,
  CommentQueryOptions
} from '../types';

export class CommentService {
  constructor(
    private pool: Pool,
    private logger: PluginLogger
  ) {}

  /**
   * Create a new comment
   */
  async createComment(input: CreateCommentInput): Promise<Comment> {
    const { post_id, user_id, author_name, author_email, content } = input;

    const result = await this.pool.query<Comment>(
      `INSERT INTO plugin_comments.comments
       (post_id, user_id, author_name, author_email, content, status)
       VALUES ($1, $2, $3, $4, $5, 'approved')
       RETURNING *`,
      [post_id, user_id, author_name, author_email, content]
    );

    this.logger.info('Comment created', {
      commentId: result.rows[0].id,
      postId: post_id,
      userId: user_id
    });

    return result.rows[0];
  }

  /**
   * Get a comment by ID
   */
  async getCommentById(id: string): Promise<Comment | null> {
    const result = await this.pool.query<Comment>(
      'SELECT * FROM plugin_comments.comments WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Get comments with optional filtering
   */
  async getComments(options: CommentQueryOptions = {}): Promise<{ comments: Comment[]; total: number }> {
    const { post_id, user_id, status, limit = 50, offset = 0 } = options;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (post_id) {
      conditions.push(`post_id = $${paramIndex++}`);
      values.push(post_id);
    }

    if (user_id) {
      conditions.push(`user_id = $${paramIndex++}`);
      values.push(user_id);
    }

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM plugin_comments.comments ${whereClause}`,
      values
    );

    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    const query = `
      SELECT * FROM plugin_comments.comments
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    const result = await this.pool.query<Comment>(
      query,
      [...values, limit, offset]
    );

    return {
      comments: result.rows,
      total
    };
  }

  /**
   * Update a comment
   */
  async updateComment(id: string, input: UpdateCommentInput): Promise<Comment | null> {
    const { content, status } = input;

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      values.push(content);
    }

    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (updates.length === 0) {
      return null;
    }

    values.push(id);

    const query = `
      UPDATE plugin_comments.comments
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query<Comment>(query, values);

    if (result.rows.length > 0) {
      this.logger.info('Comment updated', { commentId: id });
      return result.rows[0];
    }

    return null;
  }

  /**
   * Delete a comment (soft delete by marking as deleted)
   */
  async deleteComment(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE plugin_comments.comments SET status = 'deleted' WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length > 0) {
      this.logger.info('Comment deleted', { commentId: id });
      return true;
    }

    return false;
  }

  /**
   * Hard delete a comment (permanently remove from database)
   */
  async hardDeleteComment(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM plugin_comments.comments WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length > 0) {
      this.logger.info('Comment hard deleted', { commentId: id });
      return true;
    }

    return false;
  }

  /**
   * Get comment count for a post
   */
  async getCommentCountForPost(postId: string): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM plugin_comments.comments
       WHERE post_id = $1 AND status = 'approved'`,
      [postId]
    );

    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get comment counts for multiple posts
   */
  async getCommentCountsForPosts(postIds: string[]): Promise<Map<string, number>> {
    if (postIds.length === 0) {
      return new Map();
    }

    const result = await this.pool.query<{ post_id: string; count: string }>(
      `SELECT post_id, COUNT(*) as count
       FROM plugin_comments.comments
       WHERE post_id = ANY($1) AND status = 'approved'
       GROUP BY post_id`,
      [postIds]
    );

    const counts = new Map<string, number>();
    result.rows.forEach(row => {
      counts.set(row.post_id, parseInt(row.count, 10));
    });

    return counts;
  }
}
