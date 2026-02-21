/**
 * EmailService - Email Service using Resend API
 *
 * Provides email sending functionality with Resend API,
 * connection testing, and retry logic with exponential backoff.
 *
 * @module EmailService
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Resend API configuration
 */
export interface ResendConfig {
  /** Resend API key */
  apiKey: string;
  /** From email address (must be verified in Resend) */
  fromEmail: string;
}

/**
 * Legacy SMTP config interface for backward compatibility
 */
export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

/**
 * Options for sending an email
 */
export interface EmailOptions {
  /** Recipient email address */
  to: string;
  /** Email subject line */
  subject: string;
  /** Plain text email body */
  body: string;
  /** Optional HTML email body */
  html?: string;
}

/**
 * Result of sending an email
 */
export interface SendResult {
  /** Whether the email was sent successfully */
  success: boolean;
  /** Message ID from Resend (if successful) */
  messageId?: string;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Legacy preset configurations (kept for backward compatibility)
 */
export const SMTP_PRESETS: Record<string, Partial<SMTPConfig>> = {
  resend: {
    host: 'api.resend.com',
    port: 443,
    secure: true,
  },
  custom: {},
};

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * EmailService class for managing email sending via Resend API
 * Uses singleton pattern consistent with other services in the codebase
 */
class EmailService {
  private static instance: EmailService;
  private apiKey: string | null = null;
  private fromEmail: string | null = null;
  private configured: boolean = false;

  private constructor() {}

  /**
   * Get the singleton instance of EmailService
   */
  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Configure Resend API settings
   *
   * @param config - Can be ResendConfig or legacy SMTPConfig (we extract what we need)
   * @returns Promise with success status and optional error message
   */
  async configure(config: ResendConfig | SMTPConfig): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if it's a ResendConfig
      if ('apiKey' in config) {
        console.log('[EmailService] Configuring with Resend API');
        
        if (!config.apiKey) {
          return {
            success: false,
            error: 'Missing Resend API key',
          };
        }

        this.apiKey = config.apiKey;
        this.fromEmail = config.fromEmail || 'onboarding@resend.dev';
        this.configured = true;

        console.log('[EmailService] Resend configured successfully');
        return { success: true };
      }
      
      // Legacy SMTP config - check if user field contains API key pattern
      const smtpConfig = config as SMTPConfig;
      
      // If the password looks like a Resend API key (starts with re_)
      if (smtpConfig.auth?.pass?.startsWith('re_')) {
        console.log('[EmailService] Detected Resend API key in SMTP config');
        this.apiKey = smtpConfig.auth.pass;
        this.fromEmail = smtpConfig.auth.user || 'onboarding@resend.dev';
        this.configured = true;
        console.log('[EmailService] Resend configured successfully');
        return { success: true };
      }

      // Otherwise treat password as API key anyway for flexibility
      if (smtpConfig.auth?.pass) {
        console.log('[EmailService] Configuring with provided credentials as Resend API');
        this.apiKey = smtpConfig.auth.pass;
        this.fromEmail = smtpConfig.auth.user || 'onboarding@resend.dev';
        this.configured = true;
        console.log('[EmailService] Resend configured successfully');
        return { success: true };
      }

      return {
        success: false,
        error: 'Missing API key. Please enter your Resend API key in the password field.',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[EmailService] Configuration error:', errorMessage);
      return {
        success: false,
        error: `Failed to configure email: ${errorMessage}`,
      };
    }
  }

  /**
   * Test connection by making a simple API call to Resend
   *
   * @returns Promise with success status and optional error message
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.configured || !this.apiKey) {
      return {
        success: false,
        error: 'Email not configured. Please enter your Resend API key.',
      };
    }

    try {
      console.log('[EmailService] Testing Resend API connection...');

      // Test by fetching domains (lightweight API call)
      const response = await fetch('https://api.resend.com/domains', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        console.log('[EmailService] Resend API connection test successful');
        return { success: true };
      }

      const errorData = await response.json().catch(() => ({})) as { message?: string };
      const errorMessage = errorData.message || `HTTP ${response.status}`;
      
      if (response.status === 401) {
        return {
          success: false,
          error: 'Invalid API key. Please check your Resend API key.',
        };
      }

      return {
        success: false,
        error: `API error: ${errorMessage}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[EmailService] Connection test failed:', errorMessage);

      if (errorMessage.includes('fetch')) {
        return {
          success: false,
          error: 'Network error. Please check your internet connection.',
        };
      }

      return {
        success: false,
        error: `Connection test failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Send an email using Resend API with retry logic
   *
   * @param options - Email options (to, subject, body, html)
   * @returns Promise with send result including success status and message ID
   */
  async send(options: EmailOptions): Promise<SendResult> {
    if (!this.configured || !this.apiKey) {
      return {
        success: false,
        error: 'Email not configured. Please configure Resend API key first.',
      };
    }

    if (!options.to || !options.subject || !options.body) {
      return {
        success: false,
        error: 'Missing required email fields (to, subject, body)',
      };
    }

    const maxRetries = 3;
    const baseDelay = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[EmailService] Sending email attempt ${attempt}/${maxRetries} to: ${options.to}`);

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: this.fromEmail,
            to: [options.to],
            subject: options.subject,
            text: options.body,
            html: options.html || options.body.replace(/\n/g, '<br>'),
          }),
        });

        const data = await response.json() as { id?: string; message?: string };

        if (response.ok && data.id) {
          console.log('[EmailService] Email sent successfully, messageId:', data.id);
          return {
            success: true,
            messageId: data.id,
          };
        }

        throw new Error(data.message || `HTTP ${response.status}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[EmailService] Send attempt ${attempt} failed:`, errorMessage);

        if (attempt === maxRetries) {
          console.error('[EmailService] All retry attempts exhausted');
          return {
            success: false,
            error: `Failed to send email after ${maxRetries} attempts: ${errorMessage}`,
          };
        }

        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`[EmailService] Retrying in ${delay}ms...`);
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      error: 'Unexpected error in retry logic',
    };
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return this.configured && this.apiKey !== null;
  }

  /**
   * Get current configuration status (without sensitive data)
   */
  getConfigStatus(): {
    configured: boolean;
    host?: string;
    port?: number;
    user?: string;
  } {
    if (!this.configured) {
      return { configured: false };
    }

    return {
      configured: true,
      host: 'resend.com',
      port: 443,
      user: this.fromEmail || undefined,
    };
  }

  /**
   * Clear current configuration
   */
  clearConfig(): void {
    this.apiKey = null;
    this.fromEmail = null;
    this.configured = false;
    console.log('[EmailService] Configuration cleared');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static getPreset(provider: string): Partial<SMTPConfig> {
    return SMTP_PRESETS[provider] || SMTP_PRESETS.custom;
  }

  static getPresets(): Record<string, Partial<SMTPConfig>> {
    return SMTP_PRESETS;
  }
}

export function getEmailService(): EmailService {
  return EmailService.getInstance();
}

export { EmailService };
export default EmailService;
