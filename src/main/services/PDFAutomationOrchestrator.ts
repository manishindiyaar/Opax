/**
 * PDFAutomationOrchestrator - Coordinates PDF Watch & Summarize Automation
 *
 * This service orchestrates the entire PDF automation workflow by wiring together:
 * - PDFWatcherService: Detects new PDF files in the watched directory
 * - PDFProcessorService: Extracts text content from PDF files
 * - SummaryGeneratorService: Generates AI-powered summaries
 * - EmailService: Sends summary emails to the configured recipient
 *
 * Features:
 * - Start/stop automation lifecycle management
 * - Processing history tracking (max 50 entries)
 * - Event emitters for UI status updates
 * - Graceful error handling and recovery
 *
 * @module PDFAutomationOrchestrator
 * @requirements 7.1, 7.2, 7.4, 8.1, 8.2, 8.4, 8.5
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { getPDFWatcherService, FileEvent } from './PDFWatcherService';
import { getPDFProcessorService } from './PDFProcessorService';
import { getSummaryGeneratorService } from './SummaryGeneratorService';
import { getEmailService } from './EmailService';

// =============================================================================
// Types (inline to avoid tsconfig rootDir issues with shared folder)
// =============================================================================

/**
 * SMTP server configuration for email sending
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
 * Automation configuration
 */
export interface AutomationConfig {
  directoryPath: string;
  recipientEmail: string;
  enabled: boolean;
  smtpConfig?: SMTPConfig;
}

/**
 * Processing status for PDF files in the automation pipeline
 */
export type ProcessingStatus =
  | 'pending'
  | 'extracting'
  | 'summarizing'
  | 'sending'
  | 'completed'
  | 'failed';

/**
 * Processing history entry for tracking PDF processing
 */
export interface ProcessingHistoryEntry {
  id: string;
  filename: string;
  filePath: string;
  status: ProcessingStatus;
  summary?: string;
  error?: string;
  pageCount?: number;
  wordCount?: number;
  startedAt: number;
  completedAt?: number;
  emailSentAt?: number;
}

/**
 * Current status of the automation for UI display
 */
export interface AutomationStatus {
  enabled: boolean;
  directoryPath: string | null;
  recipientEmail: string | null;
  isWatching: boolean;
  emailConfigured: boolean;
  error?: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Maximum number of history entries to retain */
const MAX_HISTORY_ENTRIES = 50;

/** Consecutive failure threshold for warning */
const CONSECUTIVE_FAILURE_WARNING_THRESHOLD = 5;

// =============================================================================
// PDFAutomationOrchestrator Class
// =============================================================================

/**
 * Orchestrates the PDF Watch & Summarize automation workflow
 *
 * Events:
 * - 'processing-started': Emitted when PDF processing begins
 * - 'processing-completed': Emitted when PDF processing completes successfully
 * - 'processing-failed': Emitted when PDF processing fails
 * - 'status-changed': Emitted when automation status changes
 * - 'warning': Emitted when consecutive failures exceed threshold
 */
class PDFAutomationOrchestrator extends EventEmitter {
  private static instance: PDFAutomationOrchestrator;
  private config: AutomationConfig | null = null;
  private history: ProcessingHistoryEntry[] = [];
  private isRunning: boolean = false;
  private consecutiveFailures: number = 0;
  private lastError: string | null = null;

  // Bound event handlers for proper cleanup
  private boundPdfDetectedHandler: ((file: FileEvent) => void) | null = null;
  private boundWatcherErrorHandler: ((error: Error) => void) | null = null;

  private constructor() {
    super();
  }

  /**
   * Get the singleton instance of PDFAutomationOrchestrator
   */
  static getInstance(): PDFAutomationOrchestrator {
    if (!PDFAutomationOrchestrator.instance) {
      PDFAutomationOrchestrator.instance = new PDFAutomationOrchestrator();
    }
    return PDFAutomationOrchestrator.instance;
  }

  /**
   * Initialize and start the automation
   *
   * @param config - Automation configuration
   * @returns Promise with success status and optional error message
   *
   * @requirements 7.1, 8.1, 8.2
   */
  async start(config: AutomationConfig): Promise<{ success: boolean; error?: string }> {
    console.log('[PDFAutomationOrchestrator] Starting automation with config:', {
      directoryPath: config.directoryPath,
      recipientEmail: config.recipientEmail,
      enabled: config.enabled,
      hasSmtpConfig: !!config.smtpConfig,
    });

    // Validate configuration
    if (!config.directoryPath) {
      return { success: false, error: 'Directory path is required' };
    }

    if (!config.recipientEmail) {
      return { success: false, error: 'Recipient email is required' };
    }

    if (!config.enabled) {
      return { success: false, error: 'Automation is disabled in configuration' };
    }

    // Configure email service if SMTP config provided
    if (config.smtpConfig) {
      const emailService = getEmailService();
      const emailConfigResult = await emailService.configure(config.smtpConfig);
      if (!emailConfigResult.success) {
        console.error('[PDFAutomationOrchestrator] Failed to configure email:', emailConfigResult.error);
        return { success: false, error: `Email configuration failed: ${emailConfigResult.error}` };
      }
    }

    // Check if email is configured
    const emailService = getEmailService();
    if (!emailService.isConfigured()) {
      console.warn('[PDFAutomationOrchestrator] Email service not configured');
      // Don't fail - allow starting without email for testing
    }

    // Stop existing automation if running
    if (this.isRunning) {
      await this.stop();
    }

    // Store configuration
    this.config = config;
    this.lastError = null;
    this.consecutiveFailures = 0;

    // Set up event handlers for PDF watcher
    this.setupWatcherEventHandlers();

    // Start the PDF watcher
    const watcherService = getPDFWatcherService();
    const watcherResult = await watcherService.start({
      directoryPath: config.directoryPath,
      enabled: true,
    });

    if (!watcherResult.success) {
      this.lastError = watcherResult.error || 'Failed to start watcher';
      this.cleanupEventHandlers();
      return { success: false, error: this.lastError };
    }

    this.isRunning = true;
    console.log('[PDFAutomationOrchestrator] Automation started successfully');

    // Emit status change event
    this.emit('status-changed', this.getStatus());

    return { success: true };
  }

  /**
   * Stop the automation
   *
   * @requirements 8.1
   */
  async stop(): Promise<void> {
    console.log('[PDFAutomationOrchestrator] Stopping automation');

    // Stop the PDF watcher
    const watcherService = getPDFWatcherService();
    await watcherService.stop();

    // Clean up event handlers
    this.cleanupEventHandlers();

    // Reset state
    this.isRunning = false;
    this.config = null;
    this.lastError = null;

    console.log('[PDFAutomationOrchestrator] Automation stopped');

    // Emit status change event
    this.emit('status-changed', this.getStatus());
  }

  /**
   * Get current automation status
   *
   * @returns AutomationStatus object
   *
   * @requirements 7.1
   */
  getStatus(): AutomationStatus {
    const watcherService = getPDFWatcherService();
    const emailService = getEmailService();
    const watcherStatus = watcherService.getStatus();

    return {
      enabled: this.isRunning,
      directoryPath: this.config?.directoryPath ?? null,
      recipientEmail: this.config?.recipientEmail ?? null,
      isWatching: watcherStatus.watching,
      emailConfigured: emailService.isConfigured(),
      error: this.lastError ?? watcherStatus.error,
    };
  }

  /**
   * Get processing history
   *
   * @param limit - Optional limit on number of entries to return
   * @returns Array of ProcessingHistoryEntry objects
   *
   * @requirements 7.2, 7.4
   */
  getHistory(limit?: number): ProcessingHistoryEntry[] {
    if (limit && limit > 0) {
      return this.history.slice(0, limit);
    }
    return [...this.history];
  }

  /**
   * Clear processing history
   */
  clearHistory(): void {
    this.history = [];
    console.log('[PDFAutomationOrchestrator] History cleared');
  }

  /**
   * Get a specific history entry by ID
   *
   * @param id - History entry ID
   * @returns ProcessingHistoryEntry or undefined if not found
   */
  getHistoryEntry(id: string): ProcessingHistoryEntry | undefined {
    return this.history.find(entry => entry.id === id);
  }

  /**
   * Set up event handlers for the PDF watcher service
   */
  private setupWatcherEventHandlers(): void {
    const watcherService = getPDFWatcherService();

    // Create bound handlers for proper cleanup
    this.boundPdfDetectedHandler = (file: FileEvent) => {
      this.handlePdfDetected(file);
    };

    this.boundWatcherErrorHandler = (error: Error) => {
      this.handleWatcherError(error);
    };

    // Attach handlers
    watcherService.on('pdf-detected', this.boundPdfDetectedHandler);
    watcherService.on('error', this.boundWatcherErrorHandler);
  }

  /**
   * Clean up event handlers from the PDF watcher service
   */
  private cleanupEventHandlers(): void {
    const watcherService = getPDFWatcherService();

    if (this.boundPdfDetectedHandler) {
      watcherService.off('pdf-detected', this.boundPdfDetectedHandler);
      this.boundPdfDetectedHandler = null;
    }

    if (this.boundWatcherErrorHandler) {
      watcherService.off('error', this.boundWatcherErrorHandler);
      this.boundWatcherErrorHandler = null;
    }
  }

  /**
   * Handle PDF detected event from watcher
   *
   * @param file - FileEvent from the watcher
   */
  private async handlePdfDetected(file: FileEvent): Promise<void> {
    console.log('[PDFAutomationOrchestrator] PDF detected:', file.filename);

    // Create history entry
    const entry: ProcessingHistoryEntry = {
      id: uuidv4(),
      filename: file.filename,
      filePath: file.filePath,
      status: 'pending',
      startedAt: Date.now(),
    };

    // Add to history (enforcing limit)
    this.addHistoryEntry(entry);

    // Emit processing started event
    this.emit('processing-started', entry);

    // Process the PDF through the pipeline
    await this.processPdf(entry);
  }

  /**
   * Handle watcher error event
   *
   * @param error - Error from the watcher
   */
  private handleWatcherError(error: Error): void {
    console.error('[PDFAutomationOrchestrator] Watcher error:', error.message);
    this.lastError = error.message;
    this.emit('status-changed', this.getStatus());
  }

  /**
   * Process a PDF through the full pipeline: extract -> summarize -> email
   *
   * @param entry - ProcessingHistoryEntry to update
   *
   * @requirements 8.1, 8.2, 8.4, 8.5
   */
  private async processPdf(entry: ProcessingHistoryEntry): Promise<void> {
    try {
      // Step 1: Extract text from PDF
      entry.status = 'extracting';
      this.updateHistoryEntry(entry);

      const processorService = getPDFProcessorService();
      const extractionResult = await processorService.extractText(entry.filePath);

      if (!extractionResult.success || !extractionResult.text) {
        throw new Error(extractionResult.error || 'Failed to extract text from PDF');
      }

      entry.pageCount = extractionResult.pageCount;
      entry.wordCount = this.countWords(extractionResult.text);

      console.log(
        `[PDFAutomationOrchestrator] Extracted ${entry.wordCount} words from ${entry.pageCount} pages`
      );

      // Step 2: Generate summary
      entry.status = 'summarizing';
      this.updateHistoryEntry(entry);

      const summaryService = getSummaryGeneratorService();
      const summaryResult = await summaryService.generateSummary(
        extractionResult.text,
        entry.filename
      );

      if (!summaryResult.success || !summaryResult.summary) {
        throw new Error(summaryResult.error || 'Failed to generate summary');
      }

      entry.summary = summaryResult.summary;
      console.log(`[PDFAutomationOrchestrator] Generated summary (${summaryResult.wordCount} words)`);

      // Step 3: Send email
      entry.status = 'sending';
      this.updateHistoryEntry(entry);

      const emailService = getEmailService();

      if (!emailService.isConfigured()) {
        console.warn('[PDFAutomationOrchestrator] Email not configured, skipping email send');
        // Mark as completed even without email for testing purposes
        entry.status = 'completed';
        entry.completedAt = Date.now();
        this.updateHistoryEntry(entry);
        this.consecutiveFailures = 0;
        this.emit('processing-completed', entry);
        return;
      }

      const emailResult = await emailService.send({
        to: this.config!.recipientEmail,
        subject: `PDF Summary: ${entry.filename}`,
        body: this.formatEmailBody(entry),
        html: this.formatEmailHtml(entry),
      });

      if (!emailResult.success) {
        throw new Error(emailResult.error || 'Failed to send email');
      }

      entry.emailSentAt = Date.now();
      console.log(`[PDFAutomationOrchestrator] Email sent successfully: ${emailResult.messageId}`);

      // Mark as completed
      entry.status = 'completed';
      entry.completedAt = Date.now();
      this.updateHistoryEntry(entry);

      // Reset consecutive failures on success
      this.consecutiveFailures = 0;

      // Emit processing completed event
      this.emit('processing-completed', entry);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[PDFAutomationOrchestrator] Processing failed:', errorMessage);

      // Update entry with error
      entry.status = 'failed';
      entry.error = errorMessage;
      entry.completedAt = Date.now();
      this.updateHistoryEntry(entry);

      // Track consecutive failures
      this.consecutiveFailures++;

      // Emit warning if threshold exceeded (Requirement 8.5)
      if (this.consecutiveFailures >= CONSECUTIVE_FAILURE_WARNING_THRESHOLD) {
        console.warn(
          `[PDFAutomationOrchestrator] ${this.consecutiveFailures} consecutive failures - check configuration`
        );
        this.emit('warning', {
          message: `${this.consecutiveFailures} consecutive processing failures. Please check your configuration.`,
          consecutiveFailures: this.consecutiveFailures,
        });
      }

      // Emit processing failed event
      this.emit('processing-failed', entry);
    }
  }

  /**
   * Add a history entry, enforcing the maximum limit
   *
   * @param entry - ProcessingHistoryEntry to add
   *
   * @requirements 7.4 - History limited to 50 entries
   */
  private addHistoryEntry(entry: ProcessingHistoryEntry): void {
    // Add to the beginning of the array (newest first)
    this.history.unshift(entry);

    // Enforce maximum limit by removing oldest entries
    if (this.history.length > MAX_HISTORY_ENTRIES) {
      const removed = this.history.splice(MAX_HISTORY_ENTRIES);
      console.log(`[PDFAutomationOrchestrator] Removed ${removed.length} old history entries`);
    }
  }

  /**
   * Update an existing history entry
   *
   * @param entry - ProcessingHistoryEntry to update
   */
  private updateHistoryEntry(entry: ProcessingHistoryEntry): void {
    const index = this.history.findIndex(e => e.id === entry.id);
    if (index !== -1) {
      this.history[index] = { ...entry };
    }
  }

  /**
   * Count words in a text string
   *
   * @param text - Text to count words in
   * @returns Number of words
   */
  private countWords(text: string): number {
    if (!text || typeof text !== 'string') {
      return 0;
    }
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Format email body as plain text
   *
   * @param entry - ProcessingHistoryEntry with summary
   * @returns Formatted plain text email body
   */
  private formatEmailBody(entry: ProcessingHistoryEntry): string {
    return `PDF Summary: ${entry.filename}
=====================================

${entry.summary}

-------------------------------------
Document Details:
- Pages: ${entry.pageCount || 'Unknown'}
- Word Count: ${entry.wordCount || 'Unknown'}
- Processed: ${new Date(entry.startedAt).toLocaleString()}

This summary was automatically generated by Opax PDF Watch & Summarize.`;
  }

  /**
   * Format email body as HTML
   *
   * @param entry - ProcessingHistoryEntry with summary
   * @returns Formatted HTML email body
   */
  private formatEmailHtml(entry: ProcessingHistoryEntry): string {
    return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background: #4a90d9; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { padding: 20px; background: #f9f9f9; }
    .summary { background: white; padding: 15px; border-radius: 4px; border-left: 4px solid #4a90d9; }
    .details { margin-top: 20px; font-size: 0.9em; color: #666; }
    .footer { padding: 15px; background: #eee; border-radius: 0 0 8px 8px; font-size: 0.8em; color: #888; }
  </style>
</head>
<body>
  <div class="header">
    <h2 style="margin: 0;">PDF Summary: ${this.escapeHtml(entry.filename)}</h2>
  </div>
  <div class="content">
    <div class="summary">
      ${this.escapeHtml(entry.summary || '').replace(/\n/g, '<br>')}
    </div>
    <div class="details">
      <p><strong>Document Details:</strong></p>
      <ul>
        <li>Pages: ${entry.pageCount || 'Unknown'}</li>
        <li>Word Count: ${entry.wordCount || 'Unknown'}</li>
        <li>Processed: ${new Date(entry.startedAt).toLocaleString()}</li>
      </ul>
    </div>
  </div>
  <div class="footer">
    This summary was automatically generated by Opax PDF Watch & Summarize.
  </div>
</body>
</html>`;
  }

  /**
   * Escape HTML special characters
   *
   * @param text - Text to escape
   * @returns Escaped text
   */
  private escapeHtml(text: string): string {
    const htmlEntities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, char => htmlEntities[char] || char);
  }
}

// =============================================================================
// Exports
// =============================================================================

/**
 * Get the singleton instance of PDFAutomationOrchestrator
 */
export function getPDFAutomationOrchestrator(): PDFAutomationOrchestrator {
  return PDFAutomationOrchestrator.getInstance();
}

// Export the class for type usage
export { PDFAutomationOrchestrator };

export default PDFAutomationOrchestrator;
