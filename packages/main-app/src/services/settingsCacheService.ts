/**
 * Settings Cache Service
 *
 * Provides in-memory caching of system settings with automatic refresh.
 * This service ensures the auth system and other components can quickly
 * access settings without constant database queries.
 *
 * Features:
 * - In-memory caching with configurable TTL
 * - Automatic cache refresh on expiry
 * - Manual cache invalidation
 * - Typed getters for specific settings
 * - Fallback to secure defaults
 * - Thread-safe cache updates
 */

import { query } from '../db';
import { createLogger, LogLevel } from '@monorepo/shared';

const logger = createLogger({
  level: LogLevel.INFO,
  service: 'settings-cache',
  format: 'json'
});

// Cache entry interface
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

// Password policy interface
export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecial: boolean;
  maxLength?: number;
  preventReuse?: number;
}

// JWT configuration interface
export interface JWTConfig {
  accessTokenExpiry: string; // e.g., '15m', '1h', '7d'
  refreshTokenExpiryDays: number;
  issuer?: string;
  audience?: string;
}

// Session configuration interface
export interface SessionConfig {
  timeout: number; // minutes
  absoluteTimeout: number; // minutes
  slidingExpiration: boolean;
}

// Login security configuration interface
export interface LoginSecurityConfig {
  maxAttempts: number;
  lockoutDuration: number; // minutes
  resetAfterSuccess: boolean;
}

// Settings cache class
class SettingsCacheService {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private readonly defaultTTL: number = 5 * 60 * 1000; // 5 minutes
  private refreshPromises: Map<string, Promise<unknown>> = new Map();

  // Default values for security settings
  private readonly DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecial: true,
    maxLength: 128,
    preventReuse: 3,
  };

  private readonly DEFAULT_JWT_CONFIG: JWTConfig = {
    accessTokenExpiry: '15m',
    refreshTokenExpiryDays: 30,
    issuer: 'kevinalthaus-com',
    audience: 'kevinalthaus-com',
  };

  private readonly DEFAULT_SESSION_CONFIG: SessionConfig = {
    timeout: 30, // 30 minutes of inactivity
    absoluteTimeout: 480, // 8 hours absolute
    slidingExpiration: true,
  };

  private readonly DEFAULT_LOGIN_SECURITY: LoginSecurityConfig = {
    maxAttempts: 5,
    lockoutDuration: 15, // 15 minutes
    resetAfterSuccess: true,
  };

  /**
   * Get a setting from cache or database
   *
   * @param key - Setting key
   * @param ttl - Optional custom TTL in milliseconds
   * @returns Setting value or null
   */
  async getSetting<T>(key: string, ttl?: number): Promise<T | null> {
    const cached = this._getFromCache<T>(key);

    if (cached !== null) {
      return cached;
    }

    // Check if already refreshing
    const existingPromise = this.refreshPromises.get(key);
    if (existingPromise) {
      return existingPromise as Promise<T | null>;
    }

    // Create new refresh promise
    const refreshPromise = this._refreshFromDatabase<T>(key, ttl);
    this.refreshPromises.set(key, refreshPromise);

    try {
      const value = await refreshPromise;
      return value;
    } finally {
      this.refreshPromises.delete(key);
    }
  }

  /**
   * Get password policy from settings or return defaults
   */
  async getPasswordPolicy(): Promise<PasswordPolicy> {
    try {
      const policy = await this.getSetting<PasswordPolicy>('security.password_policy');

      if (!policy) {
        logger.debug('Using default password policy');
        return this.DEFAULT_PASSWORD_POLICY;
      }

      // Merge with defaults to ensure all required fields are present
      return {
        ...this.DEFAULT_PASSWORD_POLICY,
        ...policy,
      };
    } catch (error) {
      logger.error('Failed to get password policy, using defaults', error as Error);
      return this.DEFAULT_PASSWORD_POLICY;
    }
  }

  /**
   * Get JWT configuration from settings or return defaults
   */
  async getJWTConfig(): Promise<JWTConfig> {
    try {
      const config = await this.getSetting<JWTConfig>('security.jwt_config');

      if (!config) {
        logger.debug('Using default JWT config');
        return this.DEFAULT_JWT_CONFIG;
      }

      // Merge with defaults
      return {
        ...this.DEFAULT_JWT_CONFIG,
        ...config,
      };
    } catch (error) {
      logger.error('Failed to get JWT config, using defaults', error as Error);
      return this.DEFAULT_JWT_CONFIG;
    }
  }

  /**
   * Get session configuration from settings or return defaults
   */
  async getSessionConfig(): Promise<SessionConfig> {
    try {
      const config = await this.getSetting<SessionConfig>('security.session_config');

      if (!config) {
        logger.debug('Using default session config');
        return this.DEFAULT_SESSION_CONFIG;
      }

      // Merge with defaults
      return {
        ...this.DEFAULT_SESSION_CONFIG,
        ...config,
      };
    } catch (error) {
      logger.error('Failed to get session config, using defaults', error as Error);
      return this.DEFAULT_SESSION_CONFIG;
    }
  }

  /**
   * Get login security configuration from settings or return defaults
   */
  async getLoginSecurityConfig(): Promise<LoginSecurityConfig> {
    try {
      const config = await this.getSetting<LoginSecurityConfig>('security.login_security');

      if (!config) {
        logger.debug('Using default login security config');
        return this.DEFAULT_LOGIN_SECURITY;
      }

      // Merge with defaults
      return {
        ...this.DEFAULT_LOGIN_SECURITY,
        ...config,
      };
    } catch (error) {
      logger.error('Failed to get login security config, using defaults', error as Error);
      return this.DEFAULT_LOGIN_SECURITY;
    }
  }

  /**
   * Set a setting in both cache and database
   *
   * @param key - Setting key
   * @param value - Setting value
   * @param updatedBy - Optional user ID who updated the setting
   */
  async setSetting(key: string, value: unknown, updatedBy?: string): Promise<void> {
    try {
      // Store in database
      await query(
        `INSERT INTO system_settings (key, value, updated_by, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (key)
         DO UPDATE SET
           value = EXCLUDED.value,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()`,
        [key, JSON.stringify(value), updatedBy || null]
      );

      // Update cache
      this._setInCache(key, value);

      logger.info('Setting updated', {
        key,
        updatedBy,
      });
    } catch (error) {
      logger.error(`Failed to set setting: ${key}`, error as Error);
      throw new Error(`Failed to set setting ${key}: ${(error as Error).message}`);
    }
  }

  /**
   * Invalidate cache for a specific key or all keys
   *
   * @param key - Optional specific key to invalidate
   */
  invalidateCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
      logger.debug('Cache invalidated for key', { key });
    } else {
      this.cache.clear();
      logger.debug('All cache invalidated');
    }
  }

  /**
   * Refresh all cached settings from database
   */
  async refreshCache(): Promise<void> {
    try {
      logger.info('Refreshing settings cache');

      // Get all settings from database
      const result = await query<{ key: string; value: unknown }>(
        'SELECT key, value FROM system_settings'
      );

      // Update cache
      for (const row of result.rows) {
        this._setInCache(row.key, row.value);
      }

      logger.info('Settings cache refreshed', {
        count: result.rows.length,
      });
    } catch (error) {
      logger.error('Failed to refresh cache', error as Error);
      throw new Error(`Failed to refresh cache: ${(error as Error).message}`);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    keys: string[];
    hits: number;
    misses: number;
  } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      hits: 0, // Could be tracked with additional state
      misses: 0, // Could be tracked with additional state
    };
  }

  /**
   * Get value from cache if not expired
   */
  private _getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set value in cache with TTL
   */
  private _setInCache(key: string, value: unknown, ttl?: number): void {
    const entry: CacheEntry<unknown> = {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    };

    this.cache.set(key, entry);
  }

  /**
   * Refresh value from database and update cache
   */
  private async _refreshFromDatabase<T>(key: string, ttl?: number): Promise<T | null> {
    try {
      const result = await query<{ value: T }>(
        'SELECT value FROM system_settings WHERE key = $1',
        [key]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const value = result.rows[0].value;

      // Update cache
      this._setInCache(key, value, ttl);

      return value;
    } catch (error) {
      logger.error(`Failed to refresh setting from database: ${key}`, error as Error);
      throw new Error(`Failed to refresh setting ${key}: ${(error as Error).message}`);
    }
  }
}

// Export singleton instance
export const settingsCacheService = new SettingsCacheService();
