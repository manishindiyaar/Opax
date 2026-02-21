/**
 * AgentLogger - Structured logging service for Agent Box
 * Requirements: 7.2, 7.4, 7.5, 7.7
 * 
 * Provides structured logging with IPC communication to Renderer Process
 * for real-time log display in the Debug Console.
 */

import { BrowserWindow } from 'electron';

export type LogLevel = 'INFO' | 'SUCCESS' | 'ERROR' | 'TRIGGER' | 'DEBUG';

export interface LogEntry {
  timestamp: string;        // ISO 8601 format
  level: LogLevel;
  source: string;           // e.g., "AGENT_ENGINE", "SCHEDULER", "EXECUTOR"
  agent_id?: string;        // Optional: ID of the agent rule
  event: string;            // Event name (e.g., "TRIGGER_POLL", "STEP_EXECUTED")
  payload?: unknown;        // Optional: Additional data
}

/**
 * AgentLogger - Singleton service for structured logging
 */
export class AgentLogger {
  private static instance: AgentLogger | null = null;
  private mainWindow: BrowserWindow | null = null;
  private logBuffer: LogEntry[] = [];
  private readonly MAX_BUFFER_SIZE = 1000;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): AgentLogger {
    if (!AgentLogger.instance) {
      AgentLogger.instance = new AgentLogger();
    }
    return AgentLogger.instance;
  }

  /**
   * Set the main window for IPC communication
   */
  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  /**
   * Generic log method
   */
  log(entry: Omit<LogEntry, 'timestamp'>): void {
    const logEntry: LogEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    };

    // Add to circular buffer
    this.logBuffer.push(logEntry);
    if (this.logBuffer.length > this.MAX_BUFFER_SIZE) {
      this.logBuffer.shift(); // Remove oldest entry
    }

    // Send to Renderer via IPC
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('agent-log', logEntry);
    }

    // Also log to console for debugging
    this.logToConsole(logEntry);
  }

  /**
   * Info level log
   */
  info(source: string, event: string, payload?: unknown, agentId?: string): void {
    this.log({
      level: 'INFO',
      source,
      event,
      payload,
      agent_id: agentId
    });
  }

  /**
   * Success level log
   */
  success(source: string, event: string, payload?: unknown, agentId?: string): void {
    this.log({
      level: 'SUCCESS',
      source,
      event,
      payload,
      agent_id: agentId
    });
  }

  /**
   * Error level log
   */
  error(source: string, event: string, payload?: unknown, agentId?: string): void {
    this.log({
      level: 'ERROR',
      source,
      event,
      payload,
      agent_id: agentId
    });
  }

  /**
   * Trigger level log (for automation triggers)
   */
  trigger(source: string, event: string, payload?: unknown, agentId?: string): void {
    this.log({
      level: 'TRIGGER',
      source,
      event,
      payload,
      agent_id: agentId
    });
  }

  /**
   * Debug level log
   */
  debug(source: string, event: string, payload?: unknown, agentId?: string): void {
    this.log({
      level: 'DEBUG',
      source,
      event,
      payload,
      agent_id: agentId
    });
  }

  /**
   * Get recent logs from buffer
   */
  getRecentLogs(count?: number): LogEntry[] {
    if (count === undefined) {
      return [...this.logBuffer];
    }
    return this.logBuffer.slice(-count);
  }

  /**
   * Get logs for a specific agent
   */
  getAgentLogs(agentId: string, count?: number): LogEntry[] {
    const agentLogs = this.logBuffer.filter(entry => entry.agent_id === agentId);
    if (count === undefined) {
      return agentLogs;
    }
    return agentLogs.slice(-count);
  }

  /**
   * Clear log buffer
   */
  clearLogs(): void {
    this.logBuffer = [];
  }

  /**
   * Log to console with color coding
   */
  private logToConsole(entry: LogEntry): void {
    const prefix = `[${entry.timestamp}] [${entry.level}] [${entry.source}]`;
    const message = entry.agent_id 
      ? `${prefix} [${entry.agent_id}] ${entry.event}`
      : `${prefix} ${entry.event}`;

    switch (entry.level) {
      case 'SUCCESS':
        console.log('\x1b[32m%s\x1b[0m', message, entry.payload || '');
        break;
      case 'ERROR':
        console.error('\x1b[31m%s\x1b[0m', message, entry.payload || '');
        break;
      case 'TRIGGER':
        console.log('\x1b[36m%s\x1b[0m', message, entry.payload || '');
        break;
      case 'DEBUG':
        console.log('\x1b[90m%s\x1b[0m', message, entry.payload || '');
        break;
      default:
        console.log(message, entry.payload || '');
    }
  }
}

/**
 * Get singleton instance
 */
export function getAgentLogger(): AgentLogger {
  return AgentLogger.getInstance();
}
