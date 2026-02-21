/**
 * PDF Watch & Summarize Automation - Shared Type Definitions
 *
 * This file contains all shared interfaces, types, and enums used across
 * the main process services, IPC handlers, and renderer components for
 * the PDF automation feature.
 *
 * @module pdf-automation-types
 */
/**
 * SMTP server configuration for email sending
 */
export interface SMTPConfig {
    /** SMTP server hostname (e.g., 'smtp.gmail.com') */
    host: string;
    /** SMTP server port (e.g., 587 for TLS, 465 for SSL) */
    port: number;
    /** Whether to use SSL/TLS connection */
    secure: boolean;
    /** Authentication credentials */
    auth: {
        /** SMTP username (usually email address) */
        user: string;
        /** SMTP password or app-specific password */
        pass: string;
    };
}
/**
 * Preset SMTP configurations for common email providers
 */
export declare const SMTP_PRESETS: Record<string, Partial<SMTPConfig>>;
/**
 * Runtime automation configuration
 */
export interface AutomationConfig {
    /** Path to the directory being watched for PDF files */
    directoryPath: string;
    /** Email address to send summaries to */
    recipientEmail: string;
    /** Whether the automation is currently enabled */
    enabled: boolean;
    /** Optional SMTP configuration for email sending */
    smtpConfig?: SMTPConfig;
}
/**
 * Persisted automation configuration stored in userData
 * Extends AutomationConfig with metadata and excludes sensitive password
 */
export interface PersistedAutomationConfig {
    /** Path to the directory being watched for PDF files */
    directoryPath: string;
    /** Email address to send summaries to */
    recipientEmail: string;
    /** Whether the automation is currently enabled */
    enabled: boolean;
    /** SMTP configuration without password (stored separately in keychain) */
    smtpConfig?: {
        host: string;
        port: number;
        secure: boolean;
        user: string;
    };
    /** Timestamp when configuration was created */
    createdAt: number;
    /** Timestamp when configuration was last updated */
    updatedAt: number;
}
/**
 * Processing status for PDF files in the automation pipeline
 */
export type ProcessingStatus = 'pending' | 'extracting' | 'summarizing' | 'sending' | 'completed' | 'failed';
/**
 * Processing history entry for tracking PDF processing
 */
export interface ProcessingHistoryEntry {
    /** Unique identifier for this processing entry */
    id: string;
    /** Original filename of the PDF */
    filename: string;
    /** Full path to the PDF file */
    filePath: string;
    /** Current processing status */
    status: ProcessingStatus;
    /** Generated summary (if completed) */
    summary?: string;
    /** Error message (if failed) */
    error?: string;
    /** Number of pages in the PDF */
    pageCount?: number;
    /** Word count of extracted text */
    wordCount?: number;
    /** Timestamp when processing started */
    startedAt: number;
    /** Timestamp when processing completed */
    completedAt?: number;
    /** Timestamp when email was sent */
    emailSentAt?: number;
}
/**
 * Error codes for PDF extraction failures
 */
export type PDFErrorCode = 'EMPTY_PDF' | 'PASSWORD_PROTECTED' | 'CORRUPTED' | 'READ_ERROR';
/**
 * Result of PDF text extraction
 */
export interface PDFExtractionResult {
    /** Whether extraction was successful */
    success: boolean;
    /** Extracted text content (if successful) */
    text?: string;
    /** Number of pages in the PDF */
    pageCount?: number;
    /** Error message (if failed) */
    error?: string;
    /** Specific error code (if failed) */
    errorCode?: PDFErrorCode;
}
/**
 * File event types from the directory watcher
 */
export interface FileEvent {
    /** Type of file system event */
    type: 'add' | 'change' | 'unlink';
    /** Full path to the file */
    filePath: string;
    /** Filename without path */
    filename: string;
    /** Timestamp when event occurred */
    timestamp: number;
}
/**
 * Configuration for the PDF watcher service
 */
export interface PDFWatcherConfig {
    /** Path to the directory to watch */
    directoryPath: string;
    /** Whether watching is enabled */
    enabled: boolean;
}
/**
 * Current status of the automation for UI display
 */
export interface AutomationStatus {
    /** Whether the automation is enabled */
    enabled: boolean;
    /** Currently configured directory path (null if not configured) */
    directoryPath: string | null;
    /** Currently configured recipient email (null if not configured) */
    recipientEmail: string | null;
    /** Whether the watcher is actively monitoring */
    isWatching: boolean;
    /** Whether email/SMTP is configured */
    emailConfigured: boolean;
    /** Error message if automation is in error state */
    error?: string;
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
    /** Message ID from SMTP server (if successful) */
    messageId?: string;
    /** Error message (if failed) */
    error?: string;
}
/**
 * Generic success/error response for IPC operations
 */
export interface OperationResult {
    /** Whether the operation was successful */
    success: boolean;
    /** Error message (if failed) */
    error?: string;
}
/**
 * Response from directory selection dialog
 */
export interface DirectorySelectionResult {
    /** Whether the user canceled the dialog */
    canceled: boolean;
    /** Selected directory path (if not canceled) */
    path?: string;
}
//# sourceMappingURL=pdf-automation-types.d.ts.map