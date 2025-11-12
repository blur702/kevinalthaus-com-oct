// Set environment variables BEFORE importing the module
process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-at-least-32-chars-long-ABC123!@#';
process.env.JWT_EXPIRES_IN = '15m';
process.env.REFRESH_TOKEN_EXPIRES_IN = '7d';

import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  decodeToken,
  getRefreshTokenExpiration,
  type JWTPayload,
} from '../jwt';

describe('JWT Utils', () => {

  const mockPayload: JWTPayload = {
    userId: 'user-123',
    email: 'test@example.com',
    role: 'user',
  };

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = generateAccessToken(mockPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });

    it('should include payload data in token', () => {
      const token = generateAccessToken(mockPayload);
      const decoded = decodeToken(token);

      expect(decoded).toBeDefined();
      expect(decoded?.userId).toBe(mockPayload.userId);
      expect(decoded?.email).toBe(mockPayload.email);
      expect(decoded?.role).toBe(mockPayload.role);
    });

    it('should include expiration timestamp', () => {
      const token = generateAccessToken(mockPayload);
      const decoded = decodeToken(token);

      expect(decoded?.exp).toBeDefined();
      expect(decoded?.iat).toBeDefined();
      expect(decoded!.exp).toBeGreaterThan(decoded!.iat);
    });

    // Note: Tokens generated in the same second will be identical
    // This is expected JWT behavior - iat timestamp is in seconds
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = generateRefreshToken(mockPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);
    });

    it('should include payload data in token', () => {
      const token = generateRefreshToken(mockPayload);
      const decoded = decodeToken(token);

      expect(decoded).toBeDefined();
      expect(decoded?.userId).toBe(mockPayload.userId);
      expect(decoded?.email).toBe(mockPayload.email);
      expect(decoded?.role).toBe(mockPayload.role);
    });

    it('should have longer expiration than access token', () => {
      const accessToken = generateAccessToken(mockPayload);
      const refreshToken = generateRefreshToken(mockPayload);

      const accessDecoded = decodeToken(accessToken);
      const refreshDecoded = decodeToken(refreshToken);

      expect(refreshDecoded!.exp).toBeGreaterThan(accessDecoded!.exp);
    });
  });

  describe('verifyToken', () => {
    it('should verify and decode a valid token', () => {
      const token = generateAccessToken(mockPayload);
      const decoded = verifyToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.email).toBe(mockPayload.email);
      expect(decoded.role).toBe(mockPayload.role);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.string';

      expect(() => verifyToken(invalidToken)).toThrow('Invalid token');
    });

    it('should throw error for malformed token', () => {
      const malformedToken = 'not-a-jwt-token';

      expect(() => verifyToken(malformedToken)).toThrow();
    });

    it('should throw error for empty token', () => {
      expect(() => verifyToken('')).toThrow();
    });

    it('should throw error for token with wrong signature', () => {
      // Generate token with different secret
      const jwt = require('jsonwebtoken');
      const tokenWithWrongSecret = jwt.sign(mockPayload, 'wrong-secret', {
        expiresIn: '15m',
      });

      expect(() => verifyToken(tokenWithWrongSecret)).toThrow('Invalid token');
    });

    it('should throw error for expired token', () => {
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(mockPayload, process.env.JWT_SECRET, {
        expiresIn: '-1s', // Already expired
      });

      expect(() => verifyToken(expiredToken)).toThrow('Token has expired');
    });
  });

  describe('decodeToken', () => {
    it('should decode a valid token without verification', () => {
      const token = generateAccessToken(mockPayload);
      const decoded = decodeToken(token);

      expect(decoded).toBeDefined();
      expect(decoded?.userId).toBe(mockPayload.userId);
      expect(decoded?.email).toBe(mockPayload.email);
      expect(decoded?.role).toBe(mockPayload.role);
    });

    it('should decode token even with wrong signature', () => {
      const jwt = require('jsonwebtoken');
      const tokenWithWrongSecret = jwt.sign(mockPayload, 'wrong-secret', {
        expiresIn: '15m',
      });

      const decoded = decodeToken(tokenWithWrongSecret);

      expect(decoded).toBeDefined();
      expect(decoded?.userId).toBe(mockPayload.userId);
    });

    it('should return null for invalid token', () => {
      const invalidToken = 'not-a-jwt-token';
      const decoded = decodeToken(invalidToken);

      expect(decoded).toBeNull();
    });

    it('should return null for empty token', () => {
      const decoded = decodeToken('');

      expect(decoded).toBeNull();
    });
  });

  describe('getRefreshTokenExpiration', () => {
    it('should return a future date', () => {
      const expiration = getRefreshTokenExpiration();
      const now = new Date();

      expect(expiration).toBeInstanceOf(Date);
      expect(expiration.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should return date 7 days in future with default config', () => {
      const expiration = getRefreshTokenExpiration();
      const now = new Date();
      const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;

      const diff = expiration.getTime() - now.getTime();

      // Allow small margin for test execution time (within 1 minute)
      expect(diff).toBeGreaterThan(sevenDaysInMs - 60000);
      expect(diff).toBeLessThan(sevenDaysInMs + 60000);
    });
  });

  describe('Token Lifecycle Integration', () => {
    it('should complete full token lifecycle', () => {
      // Generate token
      const token = generateAccessToken(mockPayload);
      expect(token).toBeDefined();

      // Decode without verification
      const decoded = decodeToken(token);
      expect(decoded?.userId).toBe(mockPayload.userId);

      // Verify token
      const verified = verifyToken(token);
      expect(verified.userId).toBe(mockPayload.userId);
      expect(verified.exp).toBeDefined();
      expect(verified.iat).toBeDefined();
    });

    it('should handle different user roles', () => {
      const roles = ['user', 'admin', 'editor', 'moderator'];

      roles.forEach((role) => {
        const payload: JWTPayload = {
          ...mockPayload,
          role,
        };

        const token = generateAccessToken(payload);
        const verified = verifyToken(token);

        expect(verified.role).toBe(role);
      });
    });

    it('should handle various user IDs', () => {
      const userIds = ['123', 'user-abc', 'uuid-1234-5678-9012', ''];

      userIds.forEach((userId) => {
        const payload: JWTPayload = {
          ...mockPayload,
          userId,
        };

        const token = generateAccessToken(payload);
        const verified = verifyToken(token);

        expect(verified.userId).toBe(userId);
      });
    });

    it('should handle special characters in email', () => {
      const emails = [
        'test@example.com',
        'user+tag@example.co.uk',
        'first.last@sub.domain.com',
      ];

      emails.forEach((email) => {
        const payload: JWTPayload = {
          ...mockPayload,
          email,
        };

        const token = generateAccessToken(payload);
        const verified = verifyToken(token);

        expect(verified.email).toBe(email);
      });
    });
  });
});
