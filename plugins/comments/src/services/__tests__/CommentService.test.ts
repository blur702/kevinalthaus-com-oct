import { Pool } from 'pg';
import { CommentService } from '../CommentService';
import type { PluginLogger } from '@monorepo/shared';
import type { CreateCommentInput } from '../../types';

// Mock pg Pool
jest.mock('pg', () => {
  const mPool = {
    query: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

describe('CommentService', () => {
  let service: CommentService;
  let mockPool: jest.Mocked<Pool>;
  let mockLogger: jest.Mocked<PluginLogger>;

  beforeEach(() => {
    mockPool = new Pool() as jest.Mocked<Pool>;
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as jest.Mocked<PluginLogger>;
    service = new CommentService(mockPool, mockLogger);
  });

  describe('createComment', () => {
    it('should create a comment and return it', async () => {
      const input: CreateCommentInput = {
        post_id: '123',
        user_id: 'user-1',
        author_name: 'John Doe',
        author_email: 'john@example.com',
        content: 'Great post!',
      };

      const mockComment = {
        id: 'comment-1',
        ...input,
        status: 'approved',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockComment],
        command: 'INSERT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await service.createComment(input);

      expect(result).toEqual(mockComment);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO plugin_comments.comments'),
        [input.post_id, input.user_id, input.author_name, input.author_email, input.content]
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Comment created', {
        commentId: mockComment.id,
        postId: input.post_id,
        userId: input.user_id,
      });
    });
  });

  describe('getCommentById', () => {
    it('should return a comment by id', async () => {
      const mockComment = {
        id: 'comment-1',
        post_id: '123',
        user_id: 'user-1',
        author_name: 'John Doe',
        author_email: 'john@example.com',
        content: 'Great post!',
        status: 'approved',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockComment],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await service.getCommentById('comment-1');

      expect(result).toEqual(mockComment);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM plugin_comments.comments WHERE id = $1',
        ['comment-1']
      );
    });

    it('should return null if comment not found', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      const result = await service.getCommentById('nonexistent');

      expect(result).toBeNull();
    });
  });
});
