/**
 * Type declarations for the preload script
 * This file extends the Window interface with our custom API
 */

import { AppInfo, BackendStatus, Provider, Model, MCPServer, MCPTool, AgentRule, LogEntry } from './index';

// =============================================================================
// PDF Automation Types (Requirements: 1.1, 7.1)
// =============================================================================

interface ResendConfig {
  apiKey: string;
  fromEmail: string;
}

interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface AutomationConfig {
  directoryPath: string;
  recipientEmail: string;
  enabled: boolean;
  smtpConfig?: SMTPConfig;
}

interface AutomationStatus {
  enabled: boolean;
  directoryPath: string | null;
  recipientEmail: string | null;
  isWatching: boolean;
  emailConfigured: boolean;
  error?: string;
}

interface ProcessingHistoryEntry {
  id: string;
  filename: string;
  filePath: string;
  status: 'pending' | 'extracting' | 'summarizing' | 'sending' | 'completed' | 'failed';
  summary?: string;
  error?: string;
  pageCount?: number;
  wordCount?: number;
  startedAt: number;
  completedAt?: number;
  emailSentAt?: number;
}

interface DirectorySelectionResult {
  canceled: boolean;
  path?: string;
}

declare global {
  interface Window {
    api: {
      app: {
        getInfo: () => Promise<AppInfo>;
      };
      backend: {
        getStatus: () => Promise<BackendStatus>;
        restart: () => Promise<void>;
      };
      transcription: {
        start: () => Promise<void>;
        stop: () => Promise<{ text: string }>;
        isRecording: () => Promise<boolean>;
      };
      chat: {
        send: (message: string) => Promise<{ response: string; toolCalls?: unknown[] }>;
        clear: () => Promise<void>;
        startStream: (message: string, callback: (event: unknown) => void) => void;
      };
      settings: {
        getProviders: () => Promise<Provider[]>;
        getModels: (providerId: string) => Promise<Model[]>;
        getActiveProvider: () => Promise<string | null>;
        getActiveModel: () => Promise<string | null>;
        setActiveProvider: (providerId: string) => Promise<void>;
        setActiveModel: (modelId: string) => Promise<void>;
        getApiKey: (providerId: string) => Promise<string | null>;
        setApiKey: (providerId: string, apiKey: string) => Promise<void>;
      };
      mcp: {
        connect: (serverPath: string) => Promise<{ success: boolean; error?: string }>;
        disconnect: (serverId: string) => Promise<{ success: boolean; error?: string }>;
        listServers: () => Promise<MCPServer[]>;
        listTools: () => Promise<MCPTool[]>;
        executeTool: (toolName: string, args: Record<string, unknown>) => Promise<{ success: boolean; result?: unknown; error?: string }>;
      };
      agent: {
        createRule: (rule: Omit<AgentRule, 'id' | 'created_at' | 'updated_at'>) => Promise<{ success: boolean; rule?: AgentRule; error?: string }>;
        updateRule: (ruleId: string, updates: Partial<AgentRule>) => Promise<{ success: boolean; rule?: AgentRule; error?: string }>;
        deleteRule: (ruleId: string) => Promise<{ success: boolean; error?: string }>;
        toggleRule: (ruleId: string) => Promise<{ success: boolean; rule?: AgentRule; error?: string }>;
        listRules: () => Promise<{ success: boolean; rules: AgentRule[]; error?: string }>;
        getRuleLogs: (ruleId: string) => Promise<{ success: boolean; logs: LogEntry[]; error?: string }>;
        onLog: (callback: (log: LogEntry) => void) => void;
        onRuleDisabled: (callback: (data: { ruleId: string; ruleName: string; reason: string; lastError: string }) => void) => void;
      };
      offline: {
        startServer: (modelPath: string) => Promise<{ success: boolean; error?: string }>;
        stopServer: () => Promise<{ success: boolean; error?: string }>;
        getStatus: () => Promise<{ running: boolean; ready: boolean; modelPath: string | null }>;
      };
      // =============================================================================
      // PDF Automation API (Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 7.1)
      // =============================================================================
      pdfAutomation: {
        configure: (config: AutomationConfig) => Promise<{ success: boolean; error?: string }>;
        start: () => Promise<{ success: boolean; error?: string }>;
        stop: () => Promise<{ success: boolean; error?: string }>;
        getStatus: () => Promise<AutomationStatus>;
        getHistory: (limit?: number) => Promise<ProcessingHistoryEntry[]>;
        clearHistory: () => Promise<{ success: boolean }>;
        selectDirectory: () => Promise<DirectorySelectionResult>;
        getConfig: () => Promise<{ directoryPath: string; recipientEmail: string; enabled: boolean; smtpConfigured: boolean } | null>;
        onStatusChange: (callback: (status: AutomationStatus) => void) => void;
        onProcessingStarted: (callback: (entry: ProcessingHistoryEntry) => void) => void;
        onProcessingCompleted: (callback: (entry: ProcessingHistoryEntry) => void) => void;
        onProcessingFailed: (callback: (entry: ProcessingHistoryEntry) => void) => void;
        onWarning: (callback: (warning: { message: string; consecutiveFailures: number }) => void) => void;
      };
      // =============================================================================
      // Email Configuration API (Requirements: 6.1, 6.2, 6.3)
      // =============================================================================
      email: {
        configure: (config: ResendConfig | SMTPConfig) => Promise<{ success: boolean; error?: string }>;
        testConnection: () => Promise<{ success: boolean; error?: string }>;
        isConfigured: () => Promise<boolean>;
        getConfigStatus: () => Promise<{ configured: boolean; host?: string; port?: number; user?: string }>;
        getPresets: () => Promise<Record<string, Partial<SMTPConfig>>>;
      };
    };
    electron: {
      ipcRenderer: {
        invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
        on: (channel: string, listener: (...args: unknown[]) => void) => void;
        removeListener: (channel: string, listener: (...args: unknown[]) => void) => void;
      };
    };
  }
}

export {};
