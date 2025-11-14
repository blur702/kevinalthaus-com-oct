/**
 * Secrets Management Service using HashiCorp Vault
 *
 * Provides secure storage and retrieval of sensitive data like API keys,
 * passwords, and other credentials using HashiCorp Vault.
 *
 * Features:
 * - Automatic connection retry with exponential backoff
 * - Multiple authentication methods (token, AppRole, Kubernetes)
 * - Health checks and connection monitoring
 * - Type-safe secret storage and retrieval
 * - Fallback to environment variables in development
 */

import vault from 'node-vault';
import { createLogger, LogLevel } from '@monorepo/shared';

const logger = createLogger({
  level: LogLevel.INFO,
  service: 'secrets-service',
  format: 'json'
});

// Vault client interface
interface VaultClient {
  read(path: string): Promise<{ data: Record<string, unknown> }>;
  write(path: string, data: Record<string, unknown>): Promise<void>;
  health(): Promise<{ initialized: boolean; sealed: boolean }>;
  token?: string;
}

// Configuration interface
interface VaultConfig {
  addr: string;
  token?: string;
  namespace?: string;
  authMethod: 'token' | 'approle' | 'kubernetes';
  roleId?: string;
  secretId?: string;
  maxRetries: number;
  timeout: number;
}

// Secret storage interface
interface StoredSecret {
  value: string;
  createdAt: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
}

class SecretsService {
  private client: VaultClient | null = null;
  private config: VaultConfig;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private readonly isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';

    // Load configuration from environment
    this.config = {
      addr: process.env.VAULT_ADDR || 'http://localhost:8200',
      token: process.env.VAULT_TOKEN,
      namespace: process.env.VAULT_NAMESPACE,
      authMethod: (process.env.VAULT_AUTH_METHOD as VaultConfig['authMethod']) || 'token',
      roleId: process.env.VAULT_ROLE_ID,
      secretId: process.env.VAULT_SECRET_ID,
      maxRetries: parseInt(process.env.VAULT_MAX_RETRIES || '3', 10),
      timeout: parseInt(process.env.VAULT_TIMEOUT || '10000', 10),
    };
  }

  /**
   * Initialize the Vault client with retry logic
   */
  async initialize(): Promise<void> {
    // Return existing initialization promise if already initializing
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Return immediately if already initialized
    if (this.isInitialized && this.client) {
      return;
    }

    // Create new initialization promise
    this.initializationPromise = this._initializeClient();

    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }

  private async _initializeClient(): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        logger.info('Initializing HashiCorp Vault client', {
          attempt,
          maxRetries: this.config.maxRetries,
          addr: this.config.addr,
          authMethod: this.config.authMethod,
        });

        // Create Vault client
        const options: vault.Option = {
          apiVersion: 'v1',
          endpoint: this.config.addr,
          requestOptions: {
            timeout: this.config.timeout,
          },
        };

        if (this.config.token) {
          options.token = this.config.token;
        }

        if (this.config.namespace) {
          options.namespace = this.config.namespace;
        }

        this.client = vault(options) as unknown as VaultClient;

        // Authenticate based on method
        await this._authenticate();

        // Verify connection with health check
        await this.healthCheck();

        this.isInitialized = true;
        logger.info('HashiCorp Vault client initialized successfully');
        return;

      } catch (error) {
        lastError = error as Error;
        logger.warn('Vault initialization attempt failed', {
          attempt,
          maxRetries: this.config.maxRetries,
          error: (error as Error).message,
        });

        // Exponential backoff before retry
        if (attempt < this.config.maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // All retries failed
    const errorMessage = `Failed to initialize Vault after ${this.config.maxRetries} attempts: ${lastError?.message}`;
    logger.error(errorMessage, lastError || new Error('Unknown error'));

    // In development, log warning but don't throw (allow fallback to env vars)
    if (this.isDevelopment) {
      logger.warn('Vault initialization failed in development mode. Falling back to environment variables.');
      this.isInitialized = false;
    } else {
      throw new Error(errorMessage);
    }
  }

  /**
   * Authenticate with Vault based on configured method
   */
  private async _authenticate(): Promise<void> {
    if (!this.client) {
      throw new Error('Vault client not initialized');
    }

    switch (this.config.authMethod) {
      case 'token':
        // Token authentication - already set in options
        if (!this.config.token) {
          throw new Error('VAULT_TOKEN required for token authentication');
        }
        break;

      case 'approle': {
        // AppRole authentication
        if (!this.config.roleId || !this.config.secretId) {
          throw new Error('VAULT_ROLE_ID and VAULT_SECRET_ID required for AppRole authentication');
        }

        // Type assertion since node-vault types may not include all methods
        const approleClient = this.client as vault.client;
        const approleResult = await approleClient.approleLogin({
          role_id: this.config.roleId,
          secret_id: this.config.secretId,
        });

        if (approleResult?.auth?.client_token) {
          this.client.token = approleResult.auth.client_token;
          logger.info('AppRole authentication successful');
        } else {
          throw new Error('AppRole authentication failed: no token received');
        }
        break;
      }

      case 'kubernetes': {
        // Kubernetes authentication
        const jwtToken = await this._readKubernetesServiceAccountToken();
        const k8sClient = this.client as vault.client;
        const k8sResult = await k8sClient.kubernetesLogin({
          role: process.env.VAULT_K8S_ROLE || 'default',
          jwt: jwtToken,
        });

        if (k8sResult?.auth?.client_token) {
          this.client.token = k8sResult.auth.client_token;
          logger.info('Kubernetes authentication successful');
        } else {
          throw new Error('Kubernetes authentication failed: no token received');
        }
        break;
      }

      default:
        throw new Error(`Unsupported authentication method: ${String(this.config.authMethod)}`);
    }
  }

  /**
   * Read Kubernetes service account token
   */
  private async _readKubernetesServiceAccountToken(): Promise<string> {
    const fs = await import('fs/promises');
    const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';

    try {
      return await fs.readFile(tokenPath, 'utf8');
    } catch (error) {
      throw new Error(`Failed to read Kubernetes service account token: ${(error as Error).message}`);
    }
  }

  /**
   * Store a secret in Vault
   *
   * @param path - Vault path (e.g., 'secret/email/brevo')
   * @param value - Secret value to store
   * @param metadata - Optional metadata
   * @param createdBy - Optional user ID who created the secret
   */
  async storeSecret(
    path: string,
    value: string,
    metadata?: Record<string, unknown>,
    createdBy?: string
  ): Promise<void> {
    await this.initialize();

    // Fallback to environment variable in development
    if (!this.client && this.isDevelopment) {
      logger.warn('Vault not available, skipping secret storage in development mode', { path });
      return;
    }

    if (!this.client) {
      throw new Error('Vault client not initialized');
    }

    try {
      const secret: StoredSecret = {
        value,
        createdAt: new Date().toISOString(),
        createdBy,
        metadata,
      };

      await this.client.write(path, secret as unknown as Record<string, unknown>);

      logger.info('Secret stored successfully', {
        path,
        createdBy,
        hasMetadata: !!metadata,
      });
    } catch (error) {
      logger.error(`Failed to store secret at path: ${path}`, error as Error);
      throw new Error(`Failed to store secret at ${path}: ${(error as Error).message}`);
    }
  }

  /**
   * Retrieve a secret from Vault
   *
   * @param path - Vault path (e.g., 'secret/email/brevo')
   * @param fallbackEnvVar - Optional environment variable to use as fallback in development
   * @returns The secret value
   */
  async retrieveSecret(path: string, fallbackEnvVar?: string): Promise<string> {
    await this.initialize();

    // Fallback to environment variable in development
    if (!this.client && this.isDevelopment && fallbackEnvVar) {
      const envValue = process.env[fallbackEnvVar];
      if (envValue) {
        logger.warn('Vault not available, using environment variable fallback', {
          path,
          fallbackEnvVar,
        });
        return envValue;
      }
    }

    if (!this.client) {
      throw new Error('Vault client not initialized and no fallback available');
    }

    try {
      const response = await this.client.read(path);

      if (!response?.data) {
        throw new Error('No data returned from Vault');
      }

      // Extract value from stored secret
      const secretData = response.data as unknown as StoredSecret;

      if (!secretData.value) {
        throw new Error('Secret does not contain a value field');
      }

      return secretData.value;
    } catch (error) {
      logger.error(`Failed to retrieve secret from path: ${path}`, error as Error);

      // Try fallback in development
      if (this.isDevelopment && fallbackEnvVar) {
        const envValue = process.env[fallbackEnvVar];
        if (envValue) {
          logger.warn('Failed to retrieve from Vault, using environment variable fallback', {
            path,
            fallbackEnvVar,
          });
          return envValue;
        }
      }

      throw new Error(`Failed to retrieve secret from ${path}: ${(error as Error).message}`);
    }
  }

  /**
   * Check if a secret exists at the given path
   *
   * @param path - Vault path to check
   * @returns true if secret exists, false otherwise
   */
  async secretExists(path: string): Promise<boolean> {
    await this.initialize();

    if (!this.client) {
      return false;
    }

    try {
      await this.client.read(path);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Perform health check on Vault connection
   *
   * @returns Health status
   */
  async healthCheck(): Promise<{ healthy: boolean; initialized: boolean; sealed: boolean }> {
    if (!this.client) {
      return { healthy: false, initialized: false, sealed: true };
    }

    try {
      const health = await this.client.health();
      return {
        healthy: health.initialized && !health.sealed,
        initialized: health.initialized,
        sealed: health.sealed,
      };
    } catch (error) {
      logger.error('Vault health check failed', error as Error);
      return { healthy: false, initialized: false, sealed: true };
    }
  }

  /**
   * Check if the service is initialized and ready
   */
  isReady(): boolean {
    return this.isInitialized && this.client !== null;
  }

  /**
   * Get configuration (for debugging)
   */
  getConfig(): Omit<VaultConfig, 'token' | 'secretId'> {
    return {
      addr: this.config.addr,
      namespace: this.config.namespace,
      authMethod: this.config.authMethod,
      roleId: this.config.roleId,
      maxRetries: this.config.maxRetries,
      timeout: this.config.timeout,
    };
  }
}

// Export singleton instance
export const secretsService = new SecretsService();
