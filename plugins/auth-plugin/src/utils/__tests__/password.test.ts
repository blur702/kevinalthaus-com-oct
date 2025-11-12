import { hashPassword, comparePassword } from '../password';

describe('Password Utils', () => {
  describe('hashPassword', () => {
    it('should hash a password successfully', async () => {
      const password = 'testPassword123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
      expect(hash).toMatch(/^\$2[aby]\$.{56}$/); // bcrypt hash format
    });

    it('should generate different hashes for the same password', async () => {
      const password = 'testPassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2); // Salts should be different
    });

    it('should handle empty password', async () => {
      const hash = await hashPassword('');
      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should handle very long passwords', async () => {
      const longPassword = 'a'.repeat(1000);
      const hash = await hashPassword(longPassword);

      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should handle special characters in password', async () => {
      const password = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should handle unicode characters', async () => {
      const password = '密码🔒🔑';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password and hash', async () => {
      const password = 'testPassword123!';
      const hash = await hashPassword(password);

      const isMatch = await comparePassword(password, hash);
      expect(isMatch).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      const password = 'testPassword123!';
      const wrongPassword = 'wrongPassword456!';
      const hash = await hashPassword(password);

      const isMatch = await comparePassword(wrongPassword, hash);
      expect(isMatch).toBe(false);
    });

    it('should return false for empty password against hash', async () => {
      const password = 'testPassword123!';
      const hash = await hashPassword(password);

      const isMatch = await comparePassword('', hash);
      expect(isMatch).toBe(false);
    });

    it('should handle case sensitivity correctly', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      const isMatchLower = await comparePassword('testpassword123!', hash);
      const isMatchUpper = await comparePassword('TESTPASSWORD123!', hash);
      const isMatchCorrect = await comparePassword('TestPassword123!', hash);

      expect(isMatchLower).toBe(false);
      expect(isMatchUpper).toBe(false);
      expect(isMatchCorrect).toBe(true);
    });

    it('should return false for invalid hash format', async () => {
      const password = 'testPassword123!';
      const invalidHash = 'not-a-valid-bcrypt-hash';

      // bcrypt returns false for invalid hashes rather than throwing
      const isMatch = await comparePassword(password, invalidHash);
      expect(isMatch).toBe(false);
    });

    it('should work with special characters', async () => {
      const password = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const hash = await hashPassword(password);

      const isMatch = await comparePassword(password, hash);
      expect(isMatch).toBe(true);
    });

    it('should work with unicode characters', async () => {
      const password = '密码🔒🔑';
      const hash = await hashPassword(password);

      const isMatch = await comparePassword(password, hash);
      expect(isMatch).toBe(true);
    });
  });

  describe('Security Tests', () => {
    it('should be computationally expensive (timing test)', async () => {
      const password = 'testPassword123!';
      const startTime = Date.now();

      await hashPassword(password);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Bcrypt should take at least 30ms to hash (security feature)
      // Lower threshold for CI environments
      expect(duration).toBeGreaterThan(30);
    });

    it('should produce consistent-length hashes regardless of password length', async () => {
      const shortPassword = 'abc';
      const longPassword = 'a'.repeat(100);

      const hash1 = await hashPassword(shortPassword);
      const hash2 = await hashPassword(longPassword);

      expect(hash1.length).toBe(hash2.length);
    });
  });
});
