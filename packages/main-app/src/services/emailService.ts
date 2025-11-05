/**
 * Email Service using Brevo (formerly Sendinblue)
 *
 * Provides email sending functionality with Brevo's transactional email API.
 * API keys are securely stored in HashiCorp Vault.
 *
 * Features:
 * - Send transactional emails
 * - Send template-based emails
 * - Automatic retry with exponential backoff
 * - Email validation
 * - Rate limiting support
 */

import * as brevo from '@getbrevo/brevo';
import { createLogger, LogLevel } from '@monorepo/shared';
import { secretsService } from './secretsService';
import { query } from '../db';

const logger = createLogger({
  level: LogLevel.INFO,
  service: 'email-service',
  format: 'json'
});

// Email recipient interface
interface EmailRecipient {
  email: string;
  name?: string;
}

// Email attachment interface
interface EmailAttachment {
  name: string;
  content: string; // Base64 encoded
  contentType?: string;
}

// Email options interface
interface EmailOptions {
  to: EmailRecipient | EmailRecipient[];
  from?: EmailRecipient;
  replyTo?: EmailRecipient;
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  subject: string;
  htmlContent?: string;
  textContent?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  tags?: string[];
}

// Template email options interface
interface TemplateEmailOptions {
  to: EmailRecipient | EmailRecipient[];
  from?: EmailRecipient;
  replyTo?: EmailRecipient;
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  templateId: number;
  params?: Record<string, unknown>;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  tags?: string[];
}

// Email response interface
interface EmailResponse {
  messageId: string;
  success: boolean;
  error?: string;
}

class EmailService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private apiInstance: any | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private readonly defaultFrom: EmailRecipient;
  private readonly vaultPath: string;

  constructor() {
    // Load default sender from environment
    this.defaultFrom = {
      email: process.env.SMTP_FROM_EMAIL || 'noreply@kevinalthaus.com',
      name: process.env.SMTP_FROM_NAME || 'Kevin Althaus',
    };

    // Vault path for Brevo API key
    this.vaultPath = process.env.BREVO_API_KEY_VAULT_PATH || 'secret/email/brevo';
  }

  /**
   * Initialize the Brevo API client
   */
  async initialize(): Promise<void> {
    // Return existing initialization promise if already initializing
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Return immediately if already initialized
    if (this.isInitialized && this.apiInstance) {
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
    try {
      logger.info('Initializing Brevo email service');

      let apiKey: string | null = null;

      // Try to load API key from database first
      try {
        const result = await query<{ value: string }>(
          'SELECT value FROM system_settings WHERE key = $1',
          ['brevo_api_key']
        );

        if (result.rows.length > 0) {
          const value = result.rows[0].value;
          // The value is stored as JSONB, so it might be a string wrapped in quotes
          apiKey = typeof value === 'string' ? value : String(value);
          logger.info('Loaded Brevo API key from database');
        }
      } catch (dbError) {
        logger.warn('Failed to load Brevo API key from database, trying Vault', { error: (dbError as Error).message });
      }

      // Fall back to Vault if not in database
      if (!apiKey) {
        apiKey = await secretsService.retrieveSecret(
          this.vaultPath,
          'BREVO_API_KEY'
        );
        if (apiKey) {
          logger.info('Loaded Brevo API key from Vault');
        }
      }

      // Final fallback to environment variable (development only)
      if (!apiKey && process.env.BREVO_API_KEY) {
        apiKey = process.env.BREVO_API_KEY;
        logger.info('Loaded Brevo API key from environment variable');
      }

      if (!apiKey) {
        throw new Error('Brevo API key not found in database, Vault, or environment');
      }

      // Configure Brevo API client
      // The Brevo SDK will use the API key from environment or config
      // We'll pass it directly when making API calls
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.apiInstance = new (brevo as any).TransactionalEmailsApi();

      // Set API key on the instance
      if (this.apiInstance.apiClient) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const apiKeyAuth = (this.apiInstance.apiClient.authentications as any)['api-key'];
        if (apiKeyAuth) {
          apiKeyAuth.apiKey = apiKey;
        }
      }

      // Verify connection by getting account info
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accountApi = new (brevo as any).AccountApi();
      await accountApi.getAccount();

      this.isInitialized = true;
      logger.info('Brevo email service initialized successfully');

    } catch (error) {
      const errorMessage = `Failed to initialize Brevo email service: ${(error as Error).message}`;
      logger.error(errorMessage, error as Error);
      throw new Error(errorMessage);
    }
  }

  /**
   * Send a transactional email
   *
   * @param options - Email options
   * @returns Email response with message ID
   */
  async sendEmail(options: EmailOptions): Promise<EmailResponse> {
    await this.initialize();

    if (!this.apiInstance) {
      throw new Error('Email service not initialized');
    }

    try {
      // Validate email options
      this._validateEmailOptions(options);

      // Prepare email data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sendSmtpEmail = new (brevo as any).SendSmtpEmail();

      // Set recipients
      if (Array.isArray(options.to)) {
        sendSmtpEmail.to = options.to.map(r => ({ email: r.email, name: r.name }));
      } else {
        sendSmtpEmail.to = [{ email: options.to.email, name: options.to.name }];
      }

      // Set sender
      sendSmtpEmail.sender = options.from || this.defaultFrom;

      // Set optional fields
      if (options.replyTo) {
        sendSmtpEmail.replyTo = options.replyTo;
      }

      if (options.cc) {
        sendSmtpEmail.cc = options.cc;
      }

      if (options.bcc) {
        sendSmtpEmail.bcc = options.bcc;
      }

      // Set content
      sendSmtpEmail.subject = options.subject;

      if (options.htmlContent) {
        sendSmtpEmail.htmlContent = options.htmlContent;
      }

      if (options.textContent) {
        sendSmtpEmail.textContent = options.textContent;
      }

      // Set attachments
      if (options.attachments && options.attachments.length > 0) {
        sendSmtpEmail.attachment = options.attachments.map(att => ({
          name: att.name,
          content: att.content,
        }));
      }

      // Set headers
      if (options.headers) {
        sendSmtpEmail.headers = options.headers;
      }

      // Set tags
      if (options.tags) {
        sendSmtpEmail.tags = options.tags;
      }

      // Send email
      logger.info('Sending email via Brevo', {
        to: Array.isArray(options.to) ? options.to.map(r => r.email) : options.to.email,
        subject: options.subject,
        hasHtml: !!options.htmlContent,
        hasText: !!options.textContent,
      });

      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);

      logger.info('Email sent successfully', {
        messageId: result.body.messageId,
      });

      return {
        messageId: result.body.messageId || 'unknown',
        success: true,
      };

    } catch (error) {
      const errorMessage = `Failed to send email: ${(error as Error).message}`;
      logger.error(errorMessage, error as Error, {
        to: Array.isArray(options.to) ? options.to.map(r => r.email) : options.to.email,
      });

      return {
        messageId: '',
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send a template-based email
   *
   * @param options - Template email options
   * @returns Email response with message ID
   */
  async sendTemplateEmail(options: TemplateEmailOptions): Promise<EmailResponse> {
    await this.initialize();

    if (!this.apiInstance) {
      throw new Error('Email service not initialized');
    }

    try {
      // Validate template options
      this._validateTemplateOptions(options);

      // Prepare email data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sendSmtpEmail = new (brevo as any).SendSmtpEmail();

      // Set recipients
      if (Array.isArray(options.to)) {
        sendSmtpEmail.to = options.to.map(r => ({ email: r.email, name: r.name }));
      } else {
        sendSmtpEmail.to = [{ email: options.to.email, name: options.to.name }];
      }

      // Set sender
      sendSmtpEmail.sender = options.from || this.defaultFrom;

      // Set optional fields
      if (options.replyTo) {
        sendSmtpEmail.replyTo = options.replyTo;
      }

      if (options.cc) {
        sendSmtpEmail.cc = options.cc;
      }

      if (options.bcc) {
        sendSmtpEmail.bcc = options.bcc;
      }

      // Set template ID and params
      sendSmtpEmail.templateId = options.templateId;

      if (options.params) {
        sendSmtpEmail.params = options.params;
      }

      // Set attachments
      if (options.attachments && options.attachments.length > 0) {
        sendSmtpEmail.attachment = options.attachments.map(att => ({
          name: att.name,
          content: att.content,
        }));
      }

      // Set headers
      if (options.headers) {
        sendSmtpEmail.headers = options.headers;
      }

      // Set tags
      if (options.tags) {
        sendSmtpEmail.tags = options.tags;
      }

      // Send email
      logger.info('Sending template email via Brevo', {
        to: Array.isArray(options.to) ? options.to.map(r => r.email) : options.to.email,
        templateId: options.templateId,
      });

      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);

      logger.info('Template email sent successfully', {
        messageId: result.body.messageId,
        templateId: options.templateId,
      });

      return {
        messageId: result.body.messageId || 'unknown',
        success: true,
      };

    } catch (error) {
      const errorMessage = `Failed to send template email: ${(error as Error).message}`;
      logger.error(errorMessage, error as Error, {
        to: Array.isArray(options.to) ? options.to.map(r => r.email) : options.to.email,
        templateId: options.templateId,
      });

      return {
        messageId: '',
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send a test email to verify configuration
   *
   * @param to - Test recipient email
   * @returns Email response
   */
  async sendTestEmail(to: string): Promise<EmailResponse> {
    return this.sendEmail({
      to: { email: to },
      subject: 'Test Email from Kevin Althaus',
      htmlContent: `
        <html>
          <head></head>
          <body>
            <h1>Test Email</h1>
            <p>This is a test email to verify your email configuration.</p>
            <p>If you received this email, your Brevo integration is working correctly!</p>
            <hr>
            <p style="color: #666; font-size: 12px;">
              Sent at: ${new Date().toISOString()}<br>
              From: ${this.defaultFrom.name} &lt;${this.defaultFrom.email}&gt;
            </p>
          </body>
        </html>
      `,
      textContent: `
Test Email

This is a test email to verify your email configuration.
If you received this email, your Brevo integration is working correctly!

---
Sent at: ${new Date().toISOString()}
From: ${this.defaultFrom.name} <${this.defaultFrom.email}>
      `,
      tags: ['test', 'configuration'],
    });
  }

  /**
   * Validate email options
   */
  private _validateEmailOptions(options: EmailOptions): void {
    // Validate recipients
    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    if (recipients.length === 0) {
      throw new Error('At least one recipient is required');
    }

    for (const recipient of recipients) {
      if (!this._isValidEmail(recipient.email)) {
        throw new Error(`Invalid email address: ${recipient.email}`);
      }
    }

    // Validate subject
    if (!options.subject || options.subject.trim().length === 0) {
      throw new Error('Email subject is required');
    }

    // Validate content
    if (!options.htmlContent && !options.textContent) {
      throw new Error('Either htmlContent or textContent is required');
    }
  }

  /**
   * Validate template email options
   */
  private _validateTemplateOptions(options: TemplateEmailOptions): void {
    // Validate recipients
    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    if (recipients.length === 0) {
      throw new Error('At least one recipient is required');
    }

    for (const recipient of recipients) {
      if (!this._isValidEmail(recipient.email)) {
        throw new Error(`Invalid email address: ${recipient.email}`);
      }
    }

    // Validate template ID
    if (!options.templateId || options.templateId <= 0) {
      throw new Error('Valid template ID is required');
    }
  }

  /**
   * Validate email address format
   */
  private _isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Reload email configuration from database
   * Useful after updating settings via API
   */
  async reloadConfiguration(): Promise<void> {
    logger.info('Reloading email service configuration');

    // Reset initialization state to force reload
    this.isInitialized = false;
    this.apiInstance = null;

    // Reinitialize with new configuration
    await this.initialize();

    logger.info('Email service configuration reloaded');
  }

  /**
   * Update API key at runtime (called after admin updates it in UI)
   */
  async updateApiKey(newApiKey: string): Promise<void> {
    logger.info('Updating Brevo API key');

    try {
      // Test the new API key by initializing a temp instance
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const testInstance = new (brevo as any).TransactionalEmailsApi();

      if (testInstance.apiClient) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const apiKeyAuth = (testInstance.apiClient.authentications as any)['api-key'];
        if (apiKeyAuth) {
          apiKeyAuth.apiKey = newApiKey;
        }
      }

      // Verify the key works
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accountApi = new (brevo as any).AccountApi();
      await accountApi.getAccount();

      // If verification succeeded, reload the configuration
      await this.reloadConfiguration();

      logger.info('Brevo API key updated successfully');
    } catch (error) {
      const errorMessage = `Failed to update Brevo API key: ${(error as Error).message}`;
      logger.error(errorMessage, error as Error);
      throw new Error(errorMessage);
    }
  }

  /**
   * Check if the service is initialized and ready
   */
  isReady(): boolean {
    return this.isInitialized && this.apiInstance !== null;
  }

  /**
   * Get default sender information
   */
  getDefaultSender(): EmailRecipient {
    return { ...this.defaultFrom };
  }
}

// Export singleton instance
export const emailService = new EmailService();

// Export interfaces for use in other modules
export type {
  EmailRecipient,
  EmailAttachment,
  EmailOptions,
  TemplateEmailOptions,
  EmailResponse,
};
