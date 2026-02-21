/**
 * AutomationConfigStore - Configuration Persistence for PDF Automation
 *
 * Provides save/load functionality for automation configuration,
 * storing data in the Electron userData directory as JSON.
 *
 * @module AutomationConfigStore
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Types
// =============================================================================

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
  smtpConfig?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
}

/**
 * Persisted automation configuration stored in userData
 * Includes metadata timestamps for tracking
 */
export interface PersistedAutomationConfig {
  /** Path to the directory being watched for PDF files */
  directoryPath: string;
  /** Email address to send summaries to */
  recipientEmail: string;
  /** Whether the automation is currently enabled */
  enabled: boolean;
  /** SMTP configuration (password stored for simplicity) */
  smtpConfig?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string; // For simplicity, store password in config
  };
  /** Timestamp when configuration was created */
  createdAt: number;
  /** Timestamp when configuration was last updated */
  updatedAt: number;
}

// =============================================================================
// Constants
// =============================================================================

/** Configuration file name */
const CONFIG_FILENAME = 'pdf-automation-config.json';

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * AutomationConfigStore class for managing automation configuration persistence
 * Uses singleton pattern consistent with other services in the codebase
 */
class AutomationConfigStore {
  private static instance: AutomationConfigStore;
  private configPath: string;

  private constructor() {
    // Get the userData directory from Electron
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, CONFIG_FILENAME);
    console.log('[AutomationConfigStore] Config path:', this.configPath);
  }

  /**
   * Get the singleton instance of AutomationConfigStore
   */
  static getInstance(): AutomationConfigStore {
    if (!AutomationConfigStore.instance) {
      AutomationConfigStore.instance = new AutomationConfigStore();
    }
    return AutomationConfigStore.instance;
  }

  /**
   * Save automation configuration to disk
   *
   * @param config - Automation configuration to save
   * @returns Promise with success status and optional error message
   *
   * Requirements: 1.4, 6.2
   */
  async save(config: AutomationConfig): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[AutomationConfigStore] Saving configuration...');

      // Validate required fields
      if (!config.directoryPath || !config.recipientEmail) {
        return {
          success: false,
          error: 'Missing required configuration fields (directoryPath, recipientEmail)',
        };
      }

      // Load existing config to preserve createdAt timestamp
      const existingConfig = await this.load();
      const now = Date.now();

      // Build persisted config with timestamps
      const persistedConfig: PersistedAutomationConfig = {
        directoryPath: config.directoryPath,
        recipientEmail: config.recipientEmail,
        enabled: config.enabled,
        smtpConfig: config.smtpConfig
          ? {
              host: config.smtpConfig.host,
              port: config.smtpConfig.port,
              secure: config.smtpConfig.secure,
              user: config.smtpConfig.user,
              pass: config.smtpConfig.pass,
            }
          : undefined,
        createdAt: existingConfig?.createdAt ?? now,
        updatedAt: now,
      };

      // Ensure the userData directory exists
      const userDataPath = path.dirname(this.configPath);
      await fs.promises.mkdir(userDataPath, { recursive: true });

      // Write config to file with pretty formatting
      const configJson = JSON.stringify(persistedConfig, null, 2);
      await fs.promises.writeFile(this.configPath, configJson, 'utf-8');

      console.log('[AutomationConfigStore] Configuration saved successfully');
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[AutomationConfigStore] Save error:', errorMessage);
      return {
        success: false,
        error: `Failed to save configuration: ${errorMessage}`,
      };
    }
  }

  /**
   * Load automation configuration from disk
   *
   * @returns Promise with persisted configuration or null if not found/invalid
   *
   * Requirements: 1.4
   */
  async load(): Promise<PersistedAutomationConfig | null> {
    try {
      console.log('[AutomationConfigStore] Loading configuration...');

      // Check if config file exists
      const fileExists = await this.exists();
      if (!fileExists) {
        console.log('[AutomationConfigStore] No configuration file found');
        return null;
      }

      // Read and parse the config file
      const configJson = await fs.promises.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(configJson) as PersistedAutomationConfig;

      // Validate the loaded config has required fields
      if (!this.isValidConfig(config)) {
        console.warn('[AutomationConfigStore] Invalid configuration format, returning null');
        return null;
      }

      console.log('[AutomationConfigStore] Configuration loaded successfully');
      return config;
    } catch (error) {
      // Handle JSON parse errors (corrupted file)
      if (error instanceof SyntaxError) {
        console.error('[AutomationConfigStore] Corrupted configuration file, returning null');
        return null;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[AutomationConfigStore] Load error:', errorMessage);
      return null;
    }
  }

  /**
   * Clear (delete) the configuration file
   *
   * @returns Promise with success status and optional error message
   */
  async clear(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[AutomationConfigStore] Clearing configuration...');

      // Check if file exists before attempting to delete
      const fileExists = await this.exists();
      if (!fileExists) {
        console.log('[AutomationConfigStore] No configuration file to clear');
        return { success: true };
      }

      // Delete the config file
      await fs.promises.unlink(this.configPath);

      console.log('[AutomationConfigStore] Configuration cleared successfully');
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[AutomationConfigStore] Clear error:', errorMessage);
      return {
        success: false,
        error: `Failed to clear configuration: ${errorMessage}`,
      };
    }
  }

  /**
   * Check if a configuration file exists
   *
   * @returns Promise with boolean indicating if config exists
   */
  async exists(): Promise<boolean> {
    try {
      await fs.promises.access(this.configPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the path to the configuration file
   *
   * @returns The full path to the config file
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Validate that a loaded config object has all required fields
   *
   * @param config - Config object to validate
   * @returns boolean indicating if config is valid
   */
  private isValidConfig(config: unknown): config is PersistedAutomationConfig {
    if (!config || typeof config !== 'object') {
      return false;
    }

    const c = config as Record<string, unknown>;

    // Check required fields
    if (typeof c.directoryPath !== 'string' || c.directoryPath.length === 0) {
      return false;
    }
    if (typeof c.recipientEmail !== 'string' || c.recipientEmail.length === 0) {
      return false;
    }
    if (typeof c.enabled !== 'boolean') {
      return false;
    }
    if (typeof c.createdAt !== 'number') {
      return false;
    }
    if (typeof c.updatedAt !== 'number') {
      return false;
    }

    // Validate smtpConfig if present
    if (c.smtpConfig !== undefined) {
      if (typeof c.smtpConfig !== 'object' || c.smtpConfig === null) {
        return false;
      }
      const smtp = c.smtpConfig as Record<string, unknown>;
      if (typeof smtp.host !== 'string') return false;
      if (typeof smtp.port !== 'number') return false;
      if (typeof smtp.secure !== 'boolean') return false;
      if (typeof smtp.user !== 'string') return false;
      if (typeof smtp.pass !== 'string') return false;
    }

    return true;
  }
}

// =============================================================================
// Exports
// =============================================================================

/**
 * Get the singleton instance of AutomationConfigStore
 */
export function getAutomationConfigStore(): AutomationConfigStore {
  return AutomationConfigStore.getInstance();
}

// Export the class for type usage
export { AutomationConfigStore };

export default AutomationConfigStore;
