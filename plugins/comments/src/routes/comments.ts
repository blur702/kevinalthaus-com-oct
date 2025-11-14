import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import type { PluginLogger } from '@monorepo/shared';
import { Role } from '@monorepo/shared';
import { CommentService } from '../services/CommentService';

export function createCommentsRouter(pool: Pool, logger: PluginLogger): Router {
  const router = Router();
  const commentService = new CommentService(pool, logger);

  /**
   * GET /api/comments
   * Get comments with optional filtering
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
      const { post_id, user_id, status, limit, offset } = req.query;

      const options = {
        post_id: post_id as string | undefined,
        user_id: user_id as string | undefined,
        status: status as 'approved' | 'pending' | 'spam' | 'deleted' | undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined
      };

      const result = await commentService.getComments(options);

      res.json({
        success: true,
        data: result.comments,
        total: result.total,
        limit: options.limit || 50,
        offset: options.offset || 0
      });
    } catch (error) {
      logger.error('Failed to fetch comments', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch comments'
      });
    }
  });

  /**
   * GET /api/comments/:id
   * Get a specific comment by ID
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const comment = await commentService.getCommentById(id);

      if (!comment) {
        res.status(404).json({
          success: false,
          error: 'Comment not found'
        });
        return;
      }

      res.json({
        success: true,
        data: comment
      });
    } catch (error) {
      logger.error('Failed to fetch comment', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch comment'
      });
    }
  });

  /**
   * POST /api/comments
   * Create a new comment (requires authentication)
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const userName = (req.user as { username?: string })?.username;
      const userEmail = (req.user as { email?: string })?.email;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const { post_id, content } = req.body;

      if (!post_id || !content) {
        res.status(400).json({
          success: false,
          error: 'post_id and content are required'
        });
        return;
      }

      if (typeof content !== 'string' || content.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Content must be a non-empty string'
        });
        return;
      }

      if (content.length > 5000) {
        res.status(400).json({
          success: false,
          error: 'Content must be less than 5000 characters'
        });
        return;
      }

      const comment = await commentService.createComment({
        post_id,
        user_id: userId,
        author_name: userName || 'Anonymous',
        author_email: userEmail || 'unknown@example.com',
        content: content.trim()
      });

      res.status(201).json({
        success: true,
        data: comment
      });
    } catch (error) {
      logger.error('Failed to create comment', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to create comment'
      });
    }
  });

  /**
   * PUT /api/comments/:id
   * Update a comment (requires authentication and ownership)
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.put('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Get the comment to verify ownership
      const existingComment = await commentService.getCommentById(id);

      if (!existingComment) {
        res.status(404).json({
          success: false,
          error: 'Comment not found'
        });
        return;
      }

      // Only the comment owner or admin can update
      if (existingComment.user_id !== userId && userRole !== Role.ADMIN) {
        res.status(403).json({
          success: false,
          error: 'Permission denied'
        });
        return;
      }

      const { content, status } = req.body;

      // Regular users can only update content, admins can update status
      const updateData: { content?: string; status?: 'approved' | 'pending' | 'spam' | 'deleted' } = {};

      if (content !== undefined) {
        if (typeof content !== 'string' || content.trim().length === 0) {
          res.status(400).json({
            success: false,
            error: 'Content must be a non-empty string'
          });
          return;
        }

        if (content.length > 5000) {
          res.status(400).json({
            success: false,
            error: 'Content must be less than 5000 characters'
          });
          return;
        }

        updateData.content = content.trim();
      }

      if (status !== undefined && userRole === Role.ADMIN) {
        if (!['approved', 'pending', 'spam', 'deleted'].includes(status)) {
          res.status(400).json({
            success: false,
            error: 'Invalid status value'
          });
          return;
        }

        updateData.status = status;
      }

      if (Object.keys(updateData).length === 0) {
        res.status(400).json({
          success: false,
          error: 'No valid fields to update'
        });
        return;
      }

      const updatedComment = await commentService.updateComment(id, updateData);

      res.json({
        success: true,
        data: updatedComment
      });
    } catch (error) {
      logger.error('Failed to update comment', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to update comment'
      });
    }
  });

  /**
   * DELETE /api/comments/:id
   * Delete a comment (requires authentication and ownership or admin)
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Get the comment to verify ownership
      const existingComment = await commentService.getCommentById(id);

      if (!existingComment) {
        res.status(404).json({
          success: false,
          error: 'Comment not found'
        });
        return;
      }

      // Only the comment owner or admin can delete
      if (existingComment.user_id !== userId && userRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Permission denied'
        });
        return;
      }

      // Soft delete by default
      const success = await commentService.deleteComment(id);

      if (success) {
        res.json({
          success: true,
          message: 'Comment deleted successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to delete comment'
        });
      }
    } catch (error) {
      logger.error('Failed to delete comment', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete comment'
      });
    }
  });

  /**
   * GET /api/comments/post/:postId/count
   * Get comment count for a specific post
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/post/:postId/count', async (req: Request, res: Response): Promise<void> => {
    try {
      const { postId } = req.params;
      const count = await commentService.getCommentCountForPost(postId);

      res.json({
        success: true,
        data: { count }
      });
    } catch (error) {
      logger.error('Failed to get comment count', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get comment count'
      });
    }
  });

  return router;
}
