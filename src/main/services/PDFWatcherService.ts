/**
 * PDFWatcherService - Directory Watcher for PDF Files
 *
 * Monitors a user-specified directory for new PDF files using chokidar.
 * Emits events when PDF files are detected, enabling the automation pipeline.
 *
 * Features:
 * - Robust file watching using chokidar (better than fs.watch)
 * - Case-insensitive .pdf extension filtering
 * - Duplicate file detection to avoid reprocessing
 * - Start/stop lifecycle management
 * - Event emitter for pdf-detected and error events
 *
 * @module PDFWatcherService
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import chokidar, { FSWatcher } from 'chokidar';

// =============================================================================
// Types (inline to avoid tsconfig rootDir issues with shared folder)
// =============================================================================

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
 * Watcher status information
 */
export interface WatcherStatus {
  /** Whether the watcher is actively monitoring */
  watching: boolean;
  /** Currently configured directory path (null if not configured) */
  directoryPath: string | null;
  /** Error message if watcher is in error state */
  error?: string;
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * PDFWatcherService class for monitoring directories for new PDF files
 * Uses singleton pattern consistent with other services in the codebase
 *
 * Events:
 * - 'pdf-detected': Emitted when a new PDF file is detected
 * - 'error': Emitted when an error occurs during watching
 */
class PDFWatcherService extends EventEmitter {
  private static instance: PDFWatcherService;
  private watcher: FSWatcher | null = null;
  private config: PDFWatcherConfig | null = null;
  private processedFiles: Set<string> = new Set();
  private lastError: string | null = null;

  private constructor() {
    super();
  }

  /**
   * Get the singleton instance of PDFWatcherService
   */
  static getInstance(): PDFWatcherService {
    if (!PDFWatcherService.instance) {
      PDFWatcherService.instance = new PDFWatcherService();
    }
    return PDFWatcherService.instance;
  }

  /**
   * Start watching the configured directory for new PDF files
   *
   * @param config - Watcher configuration with directory path and enabled flag
   * @returns Promise with success status and optional error message
   *
   * Requirements: 2.1, 2.2, 2.4, 2.5
   */
  async start(config: PDFWatcherConfig): Promise<{ success: boolean; error?: string }> {
    console.log('[PDFWatcherService] Starting watcher with config:', config);

    // Validate configuration
    if (!config.directoryPath) {
      const error = 'Directory path is required';
      console.error('[PDFWatcherService]', error);
      return { success: false, error };
    }

    if (!config.enabled) {
      console.log('[PDFWatcherService] Watcher is disabled in config');
      return { success: false, error: 'Watcher is disabled' };
    }

    // Check if directory exists
    try {
      const stats = await fs.promises.stat(config.directoryPath);
      if (!stats.isDirectory()) {
        const error = `Path is not a directory: ${config.directoryPath}`;
        console.error('[PDFWatcherService]', error);
        this.lastError = error;
        return { success: false, error };
      }
    } catch (err) {
      const error = `Directory does not exist: ${config.directoryPath}`;
      console.error('[PDFWatcherService]', error);
      this.lastError = error;
      // Emit error event for UI notification
      this.emit('error', new Error(error));
      return { success: false, error };
    }

    // Stop existing watcher if running
    if (this.watcher) {
      await this.stop();
    }

    // Store configuration
    this.config = config;
    this.lastError = null;

    try {
      // Create chokidar watcher
      // Using awaitWriteFinish to ensure files are fully written before processing
      this.watcher = chokidar.watch(config.directoryPath, {
        persistent: true,
        ignoreInitial: true, // Don't emit events for existing files
        awaitWriteFinish: {
          stabilityThreshold: 2000, // Wait 2 seconds after last write
          pollInterval: 100,
        },
        depth: 0, // Only watch the specified directory, not subdirectories
        followSymlinks: false,
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Wait for watcher to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Watcher initialization timeout'));
        }, 10000); // 10 second timeout

        this.watcher!.on('ready', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.watcher!.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      console.log('[PDFWatcherService] Watcher started successfully for:', config.directoryPath);
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const error = `Failed to start watcher: ${errorMessage}`;
      console.error('[PDFWatcherService]', error);
      this.lastError = error;
      this.emit('error', new Error(error));
      return { success: false, error };
    }
  }

  /**
   * Stop watching and release file system resources
   *
   * Requirements: 2.6
   */
  async stop(): Promise<void> {
    console.log('[PDFWatcherService] Stopping watcher');

    if (this.watcher) {
      try {
        await this.watcher.close();
        console.log('[PDFWatcherService] Watcher closed successfully');
      } catch (err) {
        console.error('[PDFWatcherService] Error closing watcher:', err);
      }
      this.watcher = null;
    }

    // Clear processed files set when stopping
    // This allows files to be reprocessed if watcher is restarted
    this.processedFiles.clear();
    this.config = null;
    this.lastError = null;
  }

  /**
   * Get current watcher status
   *
   * @returns WatcherStatus object with watching state, directory path, and any error
   */
  getStatus(): WatcherStatus {
    return {
      watching: this.watcher !== null,
      directoryPath: this.config?.directoryPath ?? null,
      error: this.lastError ?? undefined,
    };
  }

  /**
   * Check if a file has already been processed
   *
   * @param filePath - Full path to the file
   * @returns boolean indicating if file was already processed
   */
  isFileProcessed(filePath: string): boolean {
    return this.processedFiles.has(filePath);
  }

  /**
   * Mark a file as processed to avoid duplicate processing
   *
   * @param filePath - Full path to the file
   */
  markFileProcessed(filePath: string): void {
    this.processedFiles.add(filePath);
  }

  /**
   * Clear the processed files set
   * Useful for testing or when user wants to reprocess files
   */
  clearProcessedFiles(): void {
    this.processedFiles.clear();
    console.log('[PDFWatcherService] Cleared processed files set');
  }

  /**
   * Get the count of processed files
   *
   * @returns number of files that have been processed
   */
  getProcessedFilesCount(): number {
    return this.processedFiles.size;
  }

  /**
   * Set up event handlers for the chokidar watcher
   * Filters for .pdf files only (case-insensitive)
   *
   * Requirements: 2.2, 2.3
   */
  private setupEventHandlers(): void {
    if (!this.watcher) return;

    // Handle new file added
    this.watcher.on('add', (filePath: string) => {
      this.handleFileEvent('add', filePath);
    });

    // Handle file changed (optional, mainly for completeness)
    this.watcher.on('change', (filePath: string) => {
      this.handleFileEvent('change', filePath);
    });

    // Handle file removed
    this.watcher.on('unlink', (filePath: string) => {
      this.handleFileEvent('unlink', filePath);
    });

    // Handle watcher errors
    this.watcher.on('error', (err: unknown) => {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[PDFWatcherService] Watcher error:', error.message);
      this.lastError = error.message;
      this.emit('error', error);
    });
  }

  /**
   * Handle a file system event
   * Filters for .pdf files only (case-insensitive) and emits pdf-detected event
   *
   * @param type - Type of file event (add, change, unlink)
   * @param filePath - Full path to the file
   *
   * Requirements: 2.2, 2.3
   */
  private handleFileEvent(type: 'add' | 'change' | 'unlink', filePath: string): void {
    const filename = path.basename(filePath);
    const extension = path.extname(filename).toLowerCase();

    // Filter for .pdf files only (case-insensitive)
    // Requirements: 2.3 - Non-PDF files should be ignored
    if (extension !== '.pdf') {
      console.log(`[PDFWatcherService] Ignoring non-PDF file: ${filename}`);
      return;
    }

    // For 'add' events, check if file was already processed
    if (type === 'add' && this.processedFiles.has(filePath)) {
      console.log(`[PDFWatcherService] Skipping already processed file: ${filename}`);
      return;
    }

    console.log(`[PDFWatcherService] PDF file event: ${type} - ${filename}`);

    // Create file event object
    const fileEvent: FileEvent = {
      type,
      filePath,
      filename,
      timestamp: Date.now(),
    };

    // Mark file as processed for 'add' events to avoid duplicates
    if (type === 'add') {
      this.processedFiles.add(filePath);
    }

    // Emit pdf-detected event
    // Requirements: 2.2 - Detect new PDF files within 5 seconds
    this.emit('pdf-detected', fileEvent);
  }
}

/**
 * Get the singleton instance of PDFWatcherService
 */
export function getPDFWatcherService(): PDFWatcherService {
  return PDFWatcherService.getInstance();
}

// Export the class for type usage
export { PDFWatcherService };

export default PDFWatcherService;
