import { Pool } from 'pg';
import { ActivityService } from '../activityService';

// Mock pg Pool
jest.mock('pg', () => {
  const mPool = {
    query: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

describe('ActivityService', () => {
  let service: ActivityService;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    mockPool = new Pool() as jest.Mocked<Pool>;
    service = new ActivityService(mockPool);
    jest.clearAllMocks();
  });

  describe('logActivity', () => {
    it('should insert activity log and return the created record', async () => {
      const mockActivity = {
        user_id: 'user-123',
        action: 'login',
        entity_type: 'user',
        entity_id: 'user-123',
        details: { ip: '127.0.0.1' },
      };

      const mockResult = {
        rows: [{ id: 'log-1', ...mockActivity, created_at: new Date() }],
      };

      mockPool.query.mockResolvedValueOnce(mockResult as any);

      const result = await service.logActivity(mockActivity);

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_activity_log'),
        expect.arrayContaining([mockActivity.user_id, mockActivity.action])
      );
      expect(result).toEqual(mockResult.rows[0]);
    });

    it('should propagate database errors', async () => {
      const mockActivity = {
        user_id: 'user-123',
        action: 'login',
        entity_type: 'user',
        entity_id: 'user-123',
      };

      const dbError = new Error('Database connection failed');
      mockPool.query.mockRejectedValueOnce(dbError);

      await expect(service.logActivity(mockActivity)).rejects.toThrow('Database connection failed');
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUserActivity', () => {
    it('should query user activity with correct parameters', async () => {
      const userId = 'user-123';
      const mockResult = {
        rows: [
          { id: 'log-1', action: 'login', created_at: new Date() },
          { id: 'log-2', action: 'profile_update', created_at: new Date() },
        ],
      };

      mockPool.query.mockResolvedValueOnce(mockResult as any);

      const result = await service.getUserActivity(userId, { limit: 10 });

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1'),
        expect.arrayContaining([userId])
      );
      expect(result).toEqual(mockResult.rows);
    });

    it('should apply filters correctly', async () => {
      const userId = 'user-123';
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      await service.getUserActivity(userId, {
        action: 'login',
        limit: 5,
        offset: 10,
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND action = $2'),
        [userId, 'login', 5, 10]
      );
    });
  });

  describe('getRecentActivity', () => {
    it('should fetch recent activity with default limit', async () => {
      const mockResult = { rows: [] };
      mockPool.query.mockResolvedValueOnce(mockResult as any);

      await service.getRecentActivity();

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        expect.any(Array)
      );
    });
  });
});
