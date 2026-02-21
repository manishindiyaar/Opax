/**
 * Global Window augmentation for the Electron preload API.
 * 
 * The preload script exposes `window.api` via contextBridge.
 * This declaration tells TypeScript about it so we don't need
 * (window as any).api everywhere.
 */

import type {
  AppInfo,
  BackendStatus,
  ChatResponse,
  StreamEvent,
  MCPConnectResult,
  MCPServerInfo,
  MCPTool,
  MCPToolExecutionResult,
  ModelInfo,
  DownloadProgress,
  Provider,
} from '../preload/index';

declare global {
  interface Window {
    api: {
      app: {
        getInfo: () => Promise<AppInfo>;
      };
      backend: {
        getStatus: () => Promise<BackendStatus & { provider?: string; model?: string }>;
        restart: () => Promise<void>;
      };
      transcription: {
        transcribe: (audioBuffer: ArrayBuffer) => Promise<string>;
        getModels: () => Promise<string[]>;
        setModel: (modelName: string) => Promise<{ success: boolean; error?: string }>;
        getModel: () => Promise<string>;
      };
      chat: {
        send: (message: string) => Promise<ChatResponse>;
        startStream: (message: string, onEvent: (event: StreamEvent) => void) => void;
        clear: () => Promise<{ success: boolean }>;
      };
      provider: {
        list: () => Promise<Provider[]>;
        getActive: () => Promise<Provider>;
        setActive: (providerId: string) => Promise<{ success: boolean }>;
      };
      mcp: {
        connectHTTP: (url: string, name?: string) => Promise<MCPConnectResult>;
        connect: (scriptPath: string) => Promise<MCPConnectResult>;
        disconnect: (serverId: string) => Promise<{ success: boolean; error?: string }>;
        listServers: () => Promise<MCPServerInfo[]>;
        listTools: () => Promise<MCPTool[]>;
        executeTool: (toolName: string, args: Record<string, unknown>) => Promise<MCPToolExecutionResult>;
      };
      form: {
        submitResult: (toolCallId: string, result: { success: boolean; result?: unknown; error?: string }) => Promise<{ success: boolean }>;
      };
      model: {
        list: () => Promise<ModelInfo[]>;
        download: (modelId: string) => Promise<{ success: boolean; error?: string }>;
        getDownloadProgress: (modelId: string) => Promise<DownloadProgress>;
      };
      api: {
        setKeys: (config: {
          openaiApiKey?: string;
          geminiApiKey?: string;
          selectedModel?: string;
          provider?: 'openai' | 'gemini';
        }) => Promise<{ success: boolean; error?: string }>;
        getStatus: () => Promise<{ initialized: boolean; provider: string; currentModel: string }>;
      };
      offline: {
        startServer: (modelPath: string) => Promise<{ success: boolean; error?: string }>;
        stopServer: () => Promise<{ success: boolean; error?: string }>;
        getStatus: () => Promise<{ running: boolean; ready: boolean; modelPath: string | null }>;
      };
    };
  }
}
