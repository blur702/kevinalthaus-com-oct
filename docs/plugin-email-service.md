# Plugin Email Service Guide

## Overview

Plugins can now send transactional emails through the Brevo email service. The email service is automatically injected into the plugin execution context.

## Configuration

### Admin UI Setup

1. Navigate to **Admin Settings** → **Email Settings** tab
2. Configure your Brevo API key: `YOUR_BREVO_API_KEY`
3. Configure sender information:
   - **From Email**: `noreply@yourdomain.com`
   - **From Name**: `Your Name`
4. Click **Save Changes**
5. Click **Test Email** to verify configuration

### Brevo Account Info

- **Account**: your-account@example.com
- **Plan**: Free tier (300 email credits)
- **Status**: Configure your own Brevo account at https://www.brevo.com/

## Using Email Service in Plugins

### Basic Email Example

```typescript
import type { PluginExecutionContext, IEmailService } from '@monorepo/shared';

export async function handler(ctx: PluginExecutionContext) {
  // Access the email service with proper typing
  const emailService = ctx.services.email as IEmailService;

  // Send a transactional email
  const result = await emailService.sendEmail({
    to: {
      email: 'user@example.com',
      name: 'John Doe'
    },
    subject: 'Welcome to our platform!',
    htmlContent: '<h1>Welcome!</h1><p>Thanks for signing up.</p>',
    textContent: 'Welcome! Thanks for signing up.',
  });

  ctx.logger.info('Email sent successfully', {
    messageId: result.messageId
  });

  return { success: true, messageId: result.messageId };
}
```

### Advanced Email Example

```typescript
import type { PluginExecutionContext, IEmailService } from '@monorepo/shared';

export async function sendNotification(ctx: PluginExecutionContext) {
  const emailService = ctx.services.email as IEmailService;

  // Send email with multiple recipients and attachments
  const result = await emailService.sendEmail({
    to: [
      { email: 'user1@example.com', name: 'User One' },
      { email: 'user2@example.com', name: 'User Two' }
    ],
    cc: [
      { email: 'manager@example.com', name: 'Manager' }
    ],
    subject: 'Important Notification',
    htmlContent: `
      <html>
        <body>
          <h1>Important Update</h1>
          <p>This is an automated notification from your plugin.</p>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
        </body>
      </html>
    `,
    textContent: 'Important Update\n\nThis is an automated notification from your plugin.',
    tags: ['notification', 'automated'],
    headers: {
      'X-Plugin-Name': 'my-plugin',
      'X-Priority': 'high'
    }
  });

  return result;
}
```

### Error Handling

```typescript
import type { PluginExecutionContext, IEmailService } from '@monorepo/shared';

export async function safeEmailSend(ctx: PluginExecutionContext) {
  const emailService = ctx.services.email as IEmailService;

  try {
    const result = await emailService.sendEmail({
      to: { email: 'user@example.com' },
      subject: 'Test Email',
      htmlContent: '<p>Test</p>',
    });

    if (result.success) {
      ctx.logger.info('Email sent', { messageId: result.messageId });
      return { success: true };
    } else {
      ctx.logger.error('Email failed', { error: result.error });
      return { success: false, error: result.error };
    }

  } catch (error) {
    ctx.logger.error('Email service error', error as Error);
    return {
      success: false,
      error: 'Failed to send email'
    };
  }
}
```

## Email Options Reference

### EmailOptions Interface

```typescript
interface EmailOptions {
  // Required fields
  to: EmailRecipient | EmailRecipient[];  // Recipient(s)
  subject: string;                          // Email subject

  // Content (at least one required)
  htmlContent?: string;                     // HTML email body
  textContent?: string;                     // Plain text email body

  // Optional fields
  from?: EmailRecipient;                    // Sender (uses system default if not provided)
  replyTo?: EmailRecipient;                 // Reply-to address
  cc?: EmailRecipient[];                    // CC recipients
  bcc?: EmailRecipient[];                   // BCC recipients
  attachments?: EmailAttachment[];          // File attachments
  headers?: Record<string, string>;         // Custom headers
  tags?: string[];                          // Email tags for tracking
}

interface EmailRecipient {
  email: string;   // Email address
  name?: string;   // Display name (optional)
}

interface EmailAttachment {
  name: string;         // Filename
  content: string;      // Base64 encoded file content
  contentType?: string; // MIME type (e.g., 'application/pdf')
}
```

## Security & Permissions

### RBAC Capabilities

- Only plugins with the `EMAIL_SEND` capability can send emails
- Admins automatically have this capability
- Plugins cannot override the system sender email (security measure)

### Rate Limiting

- Email endpoints are rate-limited to prevent abuse
- Failed attempts are logged for security auditing

### Best Practices

1. **Always validate email addresses** before sending
2. **Use meaningful subject lines** for better deliverability
3. **Include both HTML and text versions** for compatibility
4. **Log all email operations** for debugging and auditing
5. **Handle errors gracefully** to prevent plugin failures

## Testing Your Plugin Email

### Using Test Email Endpoint

You can test email configuration from the Admin UI:
1. Go to Settings → Email Settings
2. Click **Test Email** button
3. Check your inbox for the test message

### Development Testing

```typescript
import type { PluginExecutionContext, IEmailService } from '@monorepo/shared';

// Add this to your plugin for testing
export async function testEmail(ctx: PluginExecutionContext) {
  const emailService = ctx.services.email as IEmailService;

  const result = await emailService.sendTestEmail(
    'your-email@example.com'
  );

  ctx.logger.info('Test email sent', { result });
  return result;
}
```

## Troubleshooting

### Common Issues

**Email not sending:**
- Check that Brevo API key is configured in Settings
- Verify IP address is whitelisted in Brevo account
- Check email credits remaining (free tier: 300/day)

**Authentication errors:**
- Ensure plugin has `EMAIL_SEND` capability
- Check that email service is initialized in plugin manager

**Invalid recipient errors:**
- Validate email addresses before sending
- Ensure recipient email format is correct

### Logs

Email operations are logged in the main-app service logs:
```bash
# View email service logs
grep "email-service" logs/main-app.log
```

## API Limits

### Brevo Free Tier Limits
- **300 emails per day**
- Up to 300 contacts
- Transactional emails only
- No SMS

## Support

For issues with:
- **Brevo API**: https://help.brevo.com
- **Plugin email integration**: Check main-app logs
- **Configuration**: Admin Settings → Email Settings

---

**Status**: ✅ Fully configured and operational
**Last Updated**: 2025-11-05
**Account**: kevin.althaus@gmail.com (300 credits)
