/**
 * Preload Script for GoatedApp
 * 
 * This script runs in a privileged context and exposes a secure API
 * to the renderer process via contextBridge.
 * 
 * Security: Only expose specific, validated methods - never expose
 * the entire ipcRenderer or other Node.js APIs.
 */

import { contextBridge, ipcRenderer } from 'electron';

// Type definitions for the exposed API
export interface AppInfo {
  name: string;
  version: string;
  platform: string;
  arch: string;
  userDataPath: string;
}

// =============================================================================
// PDF Automation Types (Requirements: 1.1, 7.1)
// =============================================================================

/**
 * Resend API configuration for email sending
 */
export interface ResendConfig {
  /** Resend API key (starts with re_) */
  apiKey: string;
  /** From email address (must be verified in Resend or use onboarding@resend.dev) */
  fromEmail: string;
}

/**
 * Legacy SMTP config interface for backward compatibility
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
  status: 'pending' | 'extracting' | 'summarizing' | 'sending' | 'completed' | 'failed';
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
 * Response from directory selection dialog
 */
export interface DirectorySelectionResult {
  /** Whether the user canceled the dialog */
  canceled: boolean;
  /** Selected directory path (if not canceled) */
  path?: string;
}

export interface BackendStatus {
  running: boolean;
  pid: number | null;
  restartCount: number;
  healthy: boolean;
}

export interface Provider {
  id: string;
  name: string;
  type: 'local' | 'openai' | 'anthropic' | 'azure-openai';
  baseURL: string;
  apiKey?: string;
  isDefault?: boolean;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  serverId?: string;
}

export interface MCPServerInfo {
  id: string;
  name: string;
  scriptPath: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  toolCount: number;
  tools: Array<{ name: string; description: string }>;
  connectedAt?: number;
}

export interface MCPConnectResult {
  success: boolean;
  server?: MCPServerInfo;
  error?: string;
}

export interface MCPToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface MCPServerConfig {
  id: string;
  name: string;
  transport: 'stdio' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  type: 'llm' | 'whisper';
  size: number;
  status: 'not_downloaded' | 'downloading' | 'downloaded';
  localPath?: string;
}

export interface DownloadProgress {
  modelId: string;
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
}

export interface ChatResponse {
  response: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: string;
    result?: string;
    status?: 'pending' | 'success' | 'error';
  }>;
}

export interface StreamToolCall {
  id: string;
  name: string;
  arguments: string;
  result?: string;
  status: 'pending' | 'success' | 'error';
}

export type StreamEventType = 'text' | 'tool-call' | 'tool-result' | 'complete' | 'error';

export interface StreamEvent {
  type: StreamEventType;
  data: string | StreamToolCall | { toolCallId: string; result: string; status: 'success' | 'error' };
}

export interface AgentRule {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  trigger_type: 'cron' | 'event';
  cron_expression?: string;
  polling_config?: {
    mcp_server: string;
    tool_name: string;
    interval_seconds: number;
    cursor_field: string;
  };
  steps: Array<{
    id: string;
    type: 'action' | 'condition';
    mcp_server?: string;
    tool_name?: string;
    args_template?: Record<string, unknown>;
    condition_rule?: Record<string, unknown>;
  }>;
  last_run_status: 'success' | 'failed' | 'pending' | null;
  last_cursor_value?: string;
  last_run_at?: number;
  consecutive_failures: number;
  created_at: number;
  updated_at: number;
}

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'ERROR' | 'TRIGGER' | 'DEBUG';
  source: 'AGENT_ENGINE' | 'SCHEDULER' | 'EXECUTOR' | 'POLLING';
  agent_id?: string;
  event: string;
  payload?: Record<string, unknown>;
}

// Define the API that will be exposed to the renderer
const api = {
  // App information
  app: {
    getInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:getInfo'),
  },

  // Backend (Python sidecar) operations
  backend: {
    getStatus: (): Promise<BackendStatus> => ipcRenderer.invoke('backend:status'),
    restart: (): Promise<void> => ipcRenderer.invoke('backend:restart'),
  },

  // Transcription operations
  transcription: {
    transcribe: (audioBuffer: ArrayBuffer): Promise<string> =>
      ipcRenderer.invoke('transcription:transcribe', audioBuffer),
    getModels: (): Promise<string[]> =>
      ipcRenderer.invoke('transcription:getModels'),
    setModel: (modelName: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('transcription:setModel', modelName),
    getModel: (): Promise<string> =>
      ipcRenderer.invoke('transcription:getModel'),
  },

  // Chat operations
  chat: {
    send: (message: string): Promise<ChatResponse> =>
      ipcRenderer.invoke('chat:send', message),
    // Start streaming chat - returns immediately, events come via callback
    startStream: (message: string, onEvent: (event: StreamEvent) => void): void => {
      // Generate unique stream ID
      const streamId = `stream_${Date.now()}`;
      
      // Set up event listener for this stream
      const handler = (_event: unknown, data: StreamEvent) => {
        onEvent(data);
        // Clean up on complete or error
        if (data.type === 'complete' || data.type === 'error') {
          ipcRenderer.removeListener(`chat:stream:${streamId}`, handler);
        }
      };
      
      ipcRenderer.on(`chat:stream:${streamId}`, handler);
      
      // Start the stream
      ipcRenderer.invoke('chat:startStream', message, streamId);
    },
    clear: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('chat:clear'),
  },

  // Provider operations
  provider: {
    list: (): Promise<Provider[]> => ipcRenderer.invoke('provider:list'),
    getActive: (): Promise<Provider> => ipcRenderer.invoke('provider:getActive'),
    setActive: (providerId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('provider:setActive', providerId),
  },

  // MCP operations - Model Context Protocol
  mcp: {
    // Connect to an MCP server by script path (.py or .js)
    connect: (scriptPath: string): Promise<MCPConnectResult> =>
      ipcRenderer.invoke('mcp:connect', scriptPath),
    
    // Disconnect from a connected MCP server
    disconnect: (serverId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('mcp:disconnect', serverId),
    
    // List all connected MCP servers
    listServers: (): Promise<MCPServerInfo[]> =>
      ipcRenderer.invoke('mcp:listServers'),
    
    // List all available tools from all connected servers
    listTools: (): Promise<MCPTool[]> => 
      ipcRenderer.invoke('mcp:listTools'),
    
    // Execute a tool on a connected MCP server
    executeTool: (toolName: string, args: Record<string, unknown>): Promise<MCPToolExecutionResult> =>
      ipcRenderer.invoke('mcp:executeTool', toolName, args),
  },

  // Model operations
  model: {
    list: (): Promise<ModelInfo[]> => ipcRenderer.invoke('model:list'),
    download: (modelId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('model:download', modelId),
    getDownloadProgress: (modelId: string): Promise<DownloadProgress> =>
      ipcRenderer.invoke('model:getDownloadProgress', modelId),
  },

  // API key management
  api: {
    setKeys: (config: { 
      openaiApiKey?: string; 
      geminiApiKey?: string; 
      selectedModel?: string;
      provider?: 'openai' | 'gemini';
    }): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('api:setKeys', config),
    getStatus: (): Promise<{ initialized: boolean; provider: string; currentModel: string }> =>
      ipcRenderer.invoke('api:getStatus'),
  },

  // Agent Box operations
  agent: {
    createRule: (rule: Omit<AgentRule, 'id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; rule?: AgentRule; error?: string }> =>
      ipcRenderer.invoke('agent:createRule', rule),
    
    updateRule: (ruleId: string, updates: Partial<Omit<AgentRule, 'id' | 'created_at'>>): Promise<{ success: boolean; rule?: AgentRule; error?: string }> =>
      ipcRenderer.invoke('agent:updateRule', ruleId, updates),
    
    deleteRule: (ruleId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('agent:deleteRule', ruleId),
    
    toggleRule: (ruleId: string): Promise<{ success: boolean; rule?: AgentRule; error?: string }> =>
      ipcRenderer.invoke('agent:toggleRule', ruleId),
    
    listRules: (): Promise<{ success: boolean; rules: AgentRule[]; error?: string }> =>
      ipcRenderer.invoke('agent:listRules'),
    
    getRuleLogs: (ruleId: string): Promise<{ success: boolean; logs: LogEntry[]; error?: string }> =>
      ipcRenderer.invoke('agent:getRuleLogs', ruleId),
    
    // Listen for agent log events
    onLog: (callback: (log: LogEntry) => void): void => {
      ipcRenderer.on('agent-log', (_event, log: LogEntry) => callback(log));
    },
    
    // Listen for rule disabled events
    onRuleDisabled: (callback: (data: { ruleId: string; ruleName: string; reason: string; lastError: string }) => void): void => {
      ipcRenderer.on('agent:rule-disabled', (_event, data) => callback(data));
    },
  },
  
  // Offline model operations
  offline: {
    startServer: (modelPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('offline:startServer', modelPath),
    stopServer: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('offline:stopServer'),
    getStatus: (): Promise<{ running: boolean; ready: boolean; modelPath: string | null }> =>
      ipcRenderer.invoke('offline:getStatus'),
  },

  // =============================================================================
  // PDF Automation operations (Requirements: 1.1, 7.1)
  // =============================================================================
  pdfAutomation: {
    /** Configure the PDF automation with directory path, email, and SMTP settings */
    configure: (config: AutomationConfig): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('pdf-automation:configure', config),
    
    /** Start the PDF automation (begin watching directory) */
    start: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('pdf-automation:start'),
    
    /** Stop the PDF automation (stop watching directory) */
    stop: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('pdf-automation:stop'),
    
    /** Get current automation status */
    getStatus: (): Promise<AutomationStatus> =>
      ipcRenderer.invoke('pdf-automation:getStatus'),
    
    /** Get processing history entries */
    getHistory: (limit?: number): Promise<ProcessingHistoryEntry[]> =>
      ipcRenderer.invoke('pdf-automation:getHistory', limit),
    
    /** Clear all processing history */
    clearHistory: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('pdf-automation:clearHistory'),
    
    /** Open native directory picker dialog */
    selectDirectory: (): Promise<DirectorySelectionResult> =>
      ipcRenderer.invoke('pdf-automation:selectDirectory'),
    
    /** Get current configuration (without sensitive data) */
    getConfig: (): Promise<{ directoryPath: string; recipientEmail: string; enabled: boolean; smtpConfigured: boolean } | null> =>
      ipcRenderer.invoke('pdf-automation:getConfig'),
    
    // Event listeners for status updates
    /** Listen for automation status changes */
    onStatusChange: (callback: (status: AutomationStatus) => void): void => {
      ipcRenderer.on('pdf-automation:status-changed', (_event, status) => callback(status));
    },
    
    /** Listen for when PDF processing starts */
    onProcessingStarted: (callback: (entry: ProcessingHistoryEntry) => void): void => {
      ipcRenderer.on('pdf-automation:processing-started', (_event, entry) => callback(entry));
    },
    
    /** Listen for when PDF processing completes successfully */
    onProcessingCompleted: (callback: (entry: ProcessingHistoryEntry) => void): void => {
      ipcRenderer.on('pdf-automation:processing-completed', (_event, entry) => callback(entry));
    },
    
    /** Listen for when PDF processing fails */
    onProcessingFailed: (callback: (entry: ProcessingHistoryEntry) => void): void => {
      ipcRenderer.on('pdf-automation:processing-failed', (_event, entry) => callback(entry));
    },
    
    /** Listen for automation warnings (e.g., consecutive failures) */
    onWarning: (callback: (warning: { message: string; consecutiveFailures: number }) => void): void => {
      ipcRenderer.on('pdf-automation:warning', (_event, warning) => callback(warning));
    },
  },

  // =============================================================================
  // Email configuration operations (Requirements: 6.1, 6.2, 6.3)
  // =============================================================================
  email: {
    /** Configure Resend API for email sending */
    configure: (config: ResendConfig | SMTPConfig): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('email:configure', config),
    
    /** Test Resend API connection with current configuration */
    testConnection: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('email:testConnection'),
    
    /** Check if email is configured */
    isConfigured: (): Promise<boolean> =>
      ipcRenderer.invoke('email:isConfigured'),
    
    /** Get email configuration status (without sensitive API key) */
    getConfigStatus: (): Promise<{ configured: boolean; host?: string; port?: number; user?: string }> =>
      ipcRenderer.invoke('email:getConfigStatus'),
    
    /** Get email presets (legacy, returns Resend as default) */
    getPresets: (): Promise<Record<string, Partial<SMTPConfig>>> =>
      ipcRenderer.invoke('email:getPresets'),
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', api);

// Expose ipcRenderer for RxDB Electron plugin (Requirements: 1.1, 1.2)
// RxDB needs direct access to ipcRenderer for its IPC storage communication
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
    on: (channel: string, listener: (...args: unknown[]) => void) => {
      ipcRenderer.on(channel, (_event, ...args) => listener(...args));
    },
    removeListener: (channel: string, listener: (...args: unknown[]) => void) => {
      ipcRenderer.removeListener(channel, listener);
    },
  },
});

console.log('[GoatedApp] Preload script loaded');
