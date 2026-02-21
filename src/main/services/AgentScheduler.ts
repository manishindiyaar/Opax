/**
 * AgentScheduler - Manages CRON jobs and polling loops for Agent Box
 * Requirements: 8.1, 8.2, 8.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5
 * 
 * Singleton service that runs in the Electron Main Process to manage
 * automation rules with time-based (CRON) and event-based (polling) triggers.
 */

import * as cron from 'node-cron';
import { EventEmitter } from 'events';
import { AgentLogger } from './AgentLogger';
import { WorkflowExecutor, WorkflowStep } from './WorkflowExecutor';

/**
 * Agent Rule interface (minimal subset needed for scheduling)
 */
export interface AgentRule {
  id: string;
  name: string;
  trigger_type: 'cron' | 'event';
  cron_expression?: string;
  polling_config?: {
    mcp_server: string;
    tool_name: string;
    interval_seconds: number;
    cursor_field: string;
  };
  steps: WorkflowStep[];
  is_active: boolean;
  last_cursor_value?: string;
  consecutive_failures: number;
}

/**
 * AgentScheduler - Singleton service for managing automation rules
 */
export class AgentScheduler extends EventEmitter {
  private static instance: AgentScheduler | null = null;
  
  // Active CRON jobs
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  
  // Active polling intervals
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  
  // Logger instance
  private logger: AgentLogger;
  
  // Initialization state
  private initialized: boolean = false;

  // Error tracking for exponential backoff
  private failureBackoffs: Map<string, number> = new Map();
  
  // Minimum and maximum backoff intervals (in seconds)
  private readonly MIN_BACKOFF = 10;
  private readonly MAX_BACKOFF = 160;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;

  private constructor() {
    super();
    this.logger = AgentLogger.getInstance();
  }

  /**
   * Get singleton instance
   * 
   * Requirements: 8.1
   */
  static getInstance(): AgentScheduler {
    if (!AgentScheduler.instance) {
      AgentScheduler.instance = new AgentScheduler();
    }
    return AgentScheduler.instance;
  }

  /**
   * Initialize the scheduler
   * 
   * Requirements: 8.2
   * 
   * This should be called when the application starts.
   * It prepares the scheduler for loading and managing rules.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.info('SCHEDULER', 'Already initialized', {});
      return;
    }

    this.logger.info('SCHEDULER', 'Initializing AgentScheduler', {});
    
    // Clear any existing jobs/intervals (safety measure)
    this.cronJobs.clear();
    this.pollingIntervals.clear();
    this.failureBackoffs.clear();
    this.failureBackoffs.clear();
    
    this.initialized = true;
    
    this.logger.success('SCHEDULER', 'SCHEDULER_INITIALIZED', {
      cronJobCount: this.cronJobs.size,
      pollingIntervalCount: this.pollingIntervals.size
    });
  }

  /**
   * Shutdown the scheduler
   * 
   * Requirements: 8.3
   * 
   * This should be called when the application quits.
   * It gracefully stops all CRON jobs and polling loops.
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.logger.info('SCHEDULER', 'Shutting down AgentScheduler', {
      cronJobCount: this.cronJobs.size,
      pollingIntervalCount: this.pollingIntervals.size
    });

    // Stop all CRON jobs
    for (const [ruleId, task] of this.cronJobs.entries()) {
      task.stop();
      this.logger.info('SCHEDULER', `Stopped CRON job for rule ${ruleId}`, {});
    }
    this.cronJobs.clear();

    // Stop all polling intervals
    for (const [ruleId, interval] of this.pollingIntervals.entries()) {
      clearInterval(interval);
      this.logger.info('SCHEDULER', `Stopped polling for rule ${ruleId}`, {});
    }
    this.pollingIntervals.clear();

    this.initialized = false;
    
    this.logger.success('SCHEDULER', 'SCHEDULER_SHUTDOWN', {});
  }

  /**
   * Load active rules from the database
   * 
   * Requirements: 1.3, 8.2
   * 
   * Loads all active rules from RxDB and registers them with the scheduler.
   * Note: This method uses Electron IPC and will not work in test environments.
   */
  async loadActiveRules(): Promise<void> {
    if (!this.initialized) {
      throw new Error('AgentScheduler not initialized. Call initialize() first.');
    }

    this.logger.info('SCHEDULER', 'Loading active rules', {});
    
    try {
      // Check if we're in a test environment
      if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
        this.logger.info('SCHEDULER', 'Skipping rule loading in test environment', {});
        return;
      }

      // Get active rules via IPC (will be handled by main process)
      const { BrowserWindow } = await import('electron');
      const mainWindow = BrowserWindow.getAllWindows()[0];
      
      if (!mainWindow) {
        this.logger.error('SCHEDULER', 'No main window found', {});
        return;
      }

      // Request active rules from renderer
      const rules = await mainWindow.webContents.executeJavaScript(`
        (async () => {
          const { AgentRuleService } = await import('./services/AgentRuleService.js');
          return await AgentRuleService.getActiveRules();
        })()
      `);

      this.logger.info('SCHEDULER', `Found ${rules.length} active rules`, {
        count: rules.length
      });

      // Register each rule
      for (const rule of rules) {
        try {
          await this.registerRule(rule);
        } catch (error) {
          this.logger.error('SCHEDULER', `Failed to register rule ${rule.id}`, {
            ruleId: rule.id,
            ruleName: rule.name,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      this.logger.success('SCHEDULER', 'Active rules loaded', {
        count: rules.length,
        cronJobs: this.cronJobs.size,
        pollingIntervals: this.pollingIntervals.size
      });
    } catch (error) {
      this.logger.error('SCHEDULER', 'Failed to load active rules', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Register a rule with the scheduler
   * 
   * Requirements: 1.3, 2.5, 8.2
   * 
   * Based on the rule's trigger_type, this will either:
   * - Schedule a CRON job (for 'cron' type)
   * - Start polling (for 'event' type)
   */
  async registerRule(rule: AgentRule): Promise<void> {
    if (!this.initialized) {
      throw new Error('AgentScheduler not initialized. Call initialize() first.');
    }

    if (!rule.is_active) {
      this.logger.info('SCHEDULER', `Rule ${rule.id} is not active, skipping registration`, {
        ruleName: rule.name
      });
      return;
    }

    this.logger.info('SCHEDULER', `Registering rule ${rule.id}`, {
      ruleName: rule.name,
      triggerType: rule.trigger_type
    });

    // Unregister if already registered (to avoid duplicates)
    await this.unregisterRule(rule.id);

    // Register based on trigger type
    if (rule.trigger_type === 'cron') {
      this.scheduleCronJob(rule);
    } else if (rule.trigger_type === 'event') {
      this.startPolling(rule);
    } else {
      throw new Error(`Unknown trigger type: ${rule.trigger_type}`);
    }

    this.logger.success('SCHEDULER', `Rule ${rule.id} registered`, {
      ruleName: rule.name,
      triggerType: rule.trigger_type
    });
  }

  /**
   * Unregister a rule from the scheduler
   * 
   * Requirements: 1.3, 2.5, 8.2
   * 
   * This stops any active CRON jobs or polling intervals for the rule.
   */
  async unregisterRule(ruleId: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('AgentScheduler not initialized. Call initialize() first.');
    }

    this.logger.info('SCHEDULER', `Unregistering rule ${ruleId}`, {});

    // Cancel CRON job if exists
    if (this.cronJobs.has(ruleId)) {
      this.cancelCronJob(ruleId);
    }

    // Stop polling if exists
    if (this.pollingIntervals.has(ruleId)) {
      this.stopPolling(ruleId);
    }

    this.logger.info('SCHEDULER', `Rule ${ruleId} unregistered`, {});
  }

  /**
   * Schedule a CRON job for a rule
   * 
   * Requirements: 2.1, 2.2, 2.3
   * 
   * Validates the CRON expression and schedules a job using node-cron.
   * When the CRON time is reached, executes the workflow with empty trigger data.
   */
  scheduleCronJob(rule: AgentRule): void {
    if (!rule.cron_expression) {
      const error = `Rule ${rule.id} has no cron_expression`;
      this.logger.error('SCHEDULER', 'CRON_SCHEDULE_FAILED', {
        ruleId: rule.id,
        error
      });
      throw new Error(error);
    }

    // Validate CRON expression
    if (!cron.validate(rule.cron_expression)) {
      const error = `Invalid CRON expression: ${rule.cron_expression}`;
      this.logger.error('SCHEDULER', 'CRON_VALIDATION_FAILED', {
        ruleId: rule.id,
        cronExpression: rule.cron_expression,
        error
      });
      throw new Error(error);
    }

    this.logger.info('SCHEDULER', `Scheduling CRON job for rule ${rule.id}`, {
      cronExpression: rule.cron_expression,
      ruleName: rule.name
    });

    // Schedule the CRON job
    const task = cron.schedule(rule.cron_expression, async () => {
      this.logger.trigger('SCHEDULER', `CRON triggered for rule ${rule.id}`, {
        ruleId: rule.id,
        ruleName: rule.name,
        cronExpression: rule.cron_expression
      });

      try {
        // Execute workflow with empty trigger data
        const result = await WorkflowExecutor.execute(rule, {});
        
        if (result.success) {
          this.handleExecutionSuccess(rule);
        } else {
          await this.handleExecutionFailure(rule, new Error(result.error || 'Workflow execution failed'));
        }
      } catch (error) {
        await this.handleExecutionFailure(rule, error instanceof Error ? error : new Error(String(error)));
      }
    });

    // Store the task
    this.cronJobs.set(rule.id, task);

    this.logger.success('SCHEDULER', `CRON job scheduled for rule ${rule.id}`, {
      ruleId: rule.id,
      cronExpression: rule.cron_expression
    });
  }

  /**
   * Cancel a CRON job for a rule
   * 
   * Requirements: 2.1, 2.2, 2.3
   * 
   * Stops and removes the CRON job for the specified rule.
   */
  cancelCronJob(ruleId: string): void {
    const task = this.cronJobs.get(ruleId);
    
    if (!task) {
      this.logger.info('SCHEDULER', `No CRON job found for rule ${ruleId}`, {
        ruleId
      });
      return;
    }

    this.logger.info('SCHEDULER', `Cancelling CRON job for rule ${ruleId}`, {
      ruleId
    });

    // Stop the task
    task.stop();

    // Remove from map
    this.cronJobs.delete(ruleId);

    this.logger.success('SCHEDULER', `CRON job cancelled for rule ${ruleId}`, {
      ruleId
    });
  }

  /**
   * Start polling for a rule
   * 
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
   * 
   * Implements Smart Polling mechanism:
   * - Calls MCP tool at regular intervals
   * - Compares cursor field against last_cursor_value
   * - Triggers workflow only when cursor changes
   * - Implements minimum 10-second interval validation
   */
  startPolling(rule: AgentRule): void {
    if (!rule.polling_config) {
      const error = `Rule ${rule.id} has no polling_config`;
      this.logger.error('SCHEDULER', 'POLLING_START_FAILED', {
        ruleId: rule.id,
        error
      });
      throw new Error(error);
    }

    const { mcp_server, tool_name, interval_seconds, cursor_field } = rule.polling_config;

    // Validate minimum interval
    if (interval_seconds < 10) {
      const error = `Polling interval must be at least 10 seconds, got ${interval_seconds}`;
      this.logger.error('SCHEDULER', 'POLLING_VALIDATION_FAILED', {
        ruleId: rule.id,
        interval: interval_seconds,
        error
      });
      throw new Error(error);
    }

    this.logger.info('SCHEDULER', `Starting polling for rule ${rule.id}`, {
      mcpServer: mcp_server,
      toolName: tool_name,
      interval: interval_seconds,
      cursorField: cursor_field
    });

    // Create polling function
    const pollFunction = async () => {
      try {
        this.logger.debug('SCHEDULER', `Polling ${tool_name} for rule ${rule.id}`, {
          ruleId: rule.id,
          toolName: tool_name
        });

        // Call MCP tool
        const mcpService = (await import('./MCPService')).getMCPService();
        const result = await mcpService.executeTool(tool_name, {});

        if (!result.success) {
          this.logger.error('SCHEDULER', `Polling failed for rule ${rule.id}`, {
            ruleId: rule.id,
            error: result.error
          });
          return;
        }

        // Extract cursor value from result
        const cursorValue = this.extractCursorValue(result.result, cursor_field);

        if (cursorValue === undefined || cursorValue === null) {
          this.logger.error('SCHEDULER', `Cursor field '${cursor_field}' not found in polling result`, {
            ruleId: rule.id,
            cursorField: cursor_field,
            result: result.result
          });
          return;
        }

        // Convert cursor value to string for comparison
        const cursorString = String(cursorValue);

        // Check if cursor changed
        if (rule.last_cursor_value === undefined || rule.last_cursor_value !== cursorString) {
          this.logger.trigger('SCHEDULER', `Cursor changed for rule ${rule.id}`, {
            ruleId: rule.id,
            ruleName: rule.name,
            oldCursor: rule.last_cursor_value,
            newCursor: cursorString
          });

          // Update cursor value
          rule.last_cursor_value = cursorString;

          // Execute workflow with polling result as trigger data
          try {
            const executionResult = await WorkflowExecutor.execute(rule, result.result);
            
            if (executionResult.success) {
              this.handleExecutionSuccess(rule);
            } else {
              await this.handleExecutionFailure(rule, new Error(executionResult.error || 'Workflow execution failed'));
            }
          } catch (error) {
            await this.handleExecutionFailure(rule, error instanceof Error ? error : new Error(String(error)));
          }
        } else {
          this.logger.debug('SCHEDULER', `No cursor change for rule ${rule.id}`, {
            ruleId: rule.id,
            cursor: cursorString
          });
        }
      } catch (error) {
        this.logger.error('SCHEDULER', `Polling error for rule ${rule.id}`, {
          ruleId: rule.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    };

    // Start polling interval
    const intervalMs = interval_seconds * 1000;
    const interval = setInterval(pollFunction, intervalMs);

    // Store the interval
    this.pollingIntervals.set(rule.id, interval);

    // Execute immediately on start
    pollFunction();

    this.logger.success('SCHEDULER', `Polling started for rule ${rule.id}`, {
      ruleId: rule.id,
      interval: interval_seconds
    });
  }

  /**
   * Stop polling for a rule
   * 
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
   * 
   * Stops the polling interval for the specified rule.
   */
  stopPolling(ruleId: string): void {
    const interval = this.pollingIntervals.get(ruleId);
    
    if (!interval) {
      this.logger.info('SCHEDULER', `No polling interval found for rule ${ruleId}`, {
        ruleId
      });
      return;
    }

    this.logger.info('SCHEDULER', `Stopping polling for rule ${ruleId}`, {
      ruleId
    });

    // Clear the interval
    clearInterval(interval);

    // Remove from map
    this.pollingIntervals.delete(ruleId);

    this.logger.success('SCHEDULER', `Polling stopped for rule ${ruleId}`, {
      ruleId
    });
  }

  /**
   * Extract cursor value from polling result
   * 
   * Supports nested field paths using dot notation (e.g., "data.id")
   */
  private extractCursorValue(result: unknown, cursorField: string): unknown {
    if (result === null || result === undefined) {
      return undefined;
    }

    // Handle simple field access
    if (!cursorField.includes('.')) {
      return (result as Record<string, unknown>)[cursorField];
    }

    // Handle nested field access
    const fields = cursorField.split('.');
    let current: unknown = result;

    for (const field of fields) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[field];
    }

    return current;
  }

  /**
   * Get the number of active CRON jobs
   */
  getCronJobCount(): number {
    return this.cronJobs.size;
  }

  /**
   * Get the number of active polling intervals
   */
  getPollingIntervalCount(): number {
    return this.pollingIntervals.size;
  }

  /**
   * Check if scheduler is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Handle workflow execution failure
   * 
   * Requirements: 3.6, 10.3, 10.4
   * 
   * Implements exponential backoff and auto-disable after 3 consecutive failures.
   */
  private async handleExecutionFailure(rule: AgentRule, error: Error): Promise<void> {
    this.logger.error('SCHEDULER', `Execution failed for rule ${rule.id}`, {
      ruleId: rule.id,
      ruleName: rule.name,
      error: error.message,
      consecutiveFailures: rule.consecutive_failures + 1
    });

    // Increment failure count
    rule.consecutive_failures = (rule.consecutive_failures || 0) + 1;

    // Check if we should auto-disable
    if (rule.consecutive_failures >= this.MAX_CONSECUTIVE_FAILURES) {
      this.logger.error('SCHEDULER', `Auto-disabling rule ${rule.id} after ${this.MAX_CONSECUTIVE_FAILURES} failures`, {
        ruleId: rule.id,
        ruleName: rule.name
      });

      // Unregister the rule
      await this.unregisterRule(rule.id);

      // Notify renderer via IPC
      try {
        const { BrowserWindow } = await import('electron');
        const mainWindow = BrowserWindow.getAllWindows()[0];
        
        if (mainWindow) {
          mainWindow.webContents.send('agent:rule-disabled', {
            ruleId: rule.id,
            ruleName: rule.name,
            reason: `Auto-disabled after ${this.MAX_CONSECUTIVE_FAILURES} consecutive failures`,
            lastError: error.message
          });
        }
      } catch (ipcError) {
        this.logger.error('SCHEDULER', 'Failed to send rule-disabled event', {
          error: ipcError instanceof Error ? ipcError.message : String(ipcError)
        });
      }
    } else if (rule.trigger_type === 'event' && rule.polling_config) {
      // Apply exponential backoff for polling
      const currentBackoff = this.failureBackoffs.get(rule.id) || this.MIN_BACKOFF;
      const newBackoff = Math.min(currentBackoff * 2, this.MAX_BACKOFF);
      this.failureBackoffs.set(rule.id, newBackoff);

      this.logger.info('SCHEDULER', `Applying exponential backoff for rule ${rule.id}`, {
        ruleId: rule.id,
        oldInterval: currentBackoff,
        newInterval: newBackoff
      });

      // Restart polling with new interval
      this.stopPolling(rule.id);
      const modifiedRule = {
        ...rule,
        polling_config: {
          ...rule.polling_config,
          interval_seconds: newBackoff
        }
      };
      this.startPolling(modifiedRule);
    }
  }

  /**
   * Handle workflow execution success
   * 
   * Requirements: 3.6, 10.3
   * 
   * Resets failure count and backoff interval on successful execution.
   */
  private handleExecutionSuccess(rule: AgentRule): void {
    // Reset failure count
    if (rule.consecutive_failures > 0) {
      rule.consecutive_failures = 0;
      
      this.logger.success('SCHEDULER', `Rule ${rule.id} executed successfully, resetting failure count`, {
        ruleId: rule.id,
        ruleName: rule.name
      });
    }

    // Reset backoff if it was applied
    if (this.failureBackoffs.has(rule.id)) {
      const oldBackoff = this.failureBackoffs.get(rule.id);
      this.failureBackoffs.delete(rule.id);

      // If polling, restart with original interval
      if (rule.trigger_type === 'event' && rule.polling_config) {
        this.logger.info('SCHEDULER', `Resetting polling interval for rule ${rule.id}`, {
          ruleId: rule.id,
          oldInterval: oldBackoff,
          newInterval: rule.polling_config.interval_seconds
        });

        this.stopPolling(rule.id);
        this.startPolling(rule);
      }
    }
  }
}
