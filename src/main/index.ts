import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { config } from 'dotenv';
import { getWhisperService, WhisperModel } from './services/WhisperService';
import { getMCPService } from './services/MCPService';
import { getAIService } from './services/AIService';
import { AgentScheduler } from './services/AgentScheduler';
import { getPDFAutomationOrchestrator, AutomationConfig, ProcessingHistoryEntry } from './services/PDFAutomationOrchestrator';
import { getAutomationConfigStore } from './services/AutomationConfigStore';
import { getEmailService, SMTPConfig } from './services/EmailService';

// Load environment variables from .env file
config();

let mainWindow: BrowserWindow | null = null;

// Initialize services
const whisperService = getWhisperService();
const mcpService = getMCPService();
const aiService = getAIService();
const agentScheduler = AgentScheduler.getInstance();
const pdfAutomationOrchestrator = getPDFAutomationOrchestrator();
const automationConfigStore = getAutomationConfigStore();
const emailService = getEmailService();

const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged;

function createWindow(): void {
  // Create the browser window with security settings
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1200,
    minHeight: 800,
    title: 'Opax',
    webPreferences: {
      // Security: Enable context isolation
      contextIsolation: true,
      // Security: Disable node integration in renderer
      nodeIntegration: false,
      // Security: Disable remote module
      // @ts-ignore - enableRemoteModule may not be in types but is important for security
      enableRemoteModule: false,
      // Load preload script
      preload: path.join(__dirname, '../preload/index.js'),
      // Security: Disable web security only in dev mode
      webSecurity: !isDev,
    },
    // Show window when ready to prevent visual flash
    show: false,
    backgroundColor: '#FFFFFF',
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the app
  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files from app.asar
    const rendererPath = path.join(app.getAppPath(), 'dist/renderer/index.html');
    console.log('[Opax] Loading renderer from:', rendererPath);
    mainWindow.loadFile(rendererPath);
    
    // Debug in production - enable DevTools
    mainWindow.webContents.openDevTools();
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  // Initialize WhisperService
  try {
    await whisperService.initialize();
    console.log('[GoatedApp] WhisperService initialized');
  } catch (error) {
    console.error('[GoatedApp] Failed to initialize WhisperService:', error);
  }

  // Try to load API keys from localStorage via a config file
  // Since we can't access localStorage from main process, we'll use a JSON file
  const userDataPath = app.getPath('userData');
  const configPath = path.join(userDataPath, 'api-config.json');
  
  try {
    const fs = await import('fs/promises');
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);
    
    // Initialize with saved API keys
    if (config.provider === 'openai' && config.openaiApiKey) {
      aiService.initializeOpenAI(config.openaiApiKey, config.selectedModel || 'gpt-4o-mini');
      console.log('[GoatedApp] AIService initialized with OpenAI from saved config');
    } else if (config.provider === 'gemini' && config.geminiApiKey) {
      aiService.initializeGemini(config.geminiApiKey, config.selectedModel || 'gemini-2.5-flash-lite');
      console.log('[GoatedApp] AIService initialized with Gemini from saved config');
    } else if (config.openaiApiKey) {
      aiService.initializeOpenAI(config.openaiApiKey, config.selectedModel || 'gpt-4o-mini');
      console.log('[GoatedApp] AIService initialized with OpenAI from saved config');
    } else if (config.geminiApiKey) {
      aiService.initializeGemini(config.geminiApiKey, config.selectedModel || 'gemini-2.5-flash-lite');
      console.log('[GoatedApp] AIService initialized with Gemini from saved config');
    } else {
      console.warn('[GoatedApp] No API keys found in config');
    }
  } catch (error) {
    console.log('[GoatedApp] No saved API config found');
    console.log('[GoatedApp] User can configure provider in Settings');
  }

  // Fallback: Try environment variables
  if (!aiService.isInitialized()) {
    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    
    if (openaiKey) {
      aiService.initializeOpenAI(openaiKey);
      console.log('[GoatedApp] AIService initialized with OpenAI from environment');
    } else if (geminiKey) {
      aiService.initializeGemini(geminiKey);
      console.log('[GoatedApp] AIService initialized with Gemini from environment');
    } else {
      console.warn('[GoatedApp] No API keys found - user must configure in Settings');
    }
  }

  // Initialize AgentScheduler
  try {
    await agentScheduler.initialize();
    await agentScheduler.loadActiveRules();
    console.log('[GoatedApp] AgentScheduler initialized and rules loaded');
  } catch (error) {
    console.error('[GoatedApp] Failed to initialize AgentScheduler:', error);
  }

  // Initialize PDF Automation if there's a saved config with enabled=true
  try {
    const savedConfig = await automationConfigStore.load();
    if (savedConfig && savedConfig.enabled) {
      console.log('[GoatedApp] Found saved PDF automation config, starting automation...');
      
      // Convert persisted config to runtime config
      const runtimeConfig: AutomationConfig = {
        directoryPath: savedConfig.directoryPath,
        recipientEmail: savedConfig.recipientEmail,
        enabled: savedConfig.enabled,
        smtpConfig: savedConfig.smtpConfig ? {
          host: savedConfig.smtpConfig.host,
          port: savedConfig.smtpConfig.port,
          secure: savedConfig.smtpConfig.secure,
          auth: {
            user: savedConfig.smtpConfig.user,
            pass: savedConfig.smtpConfig.pass,
          },
        } : undefined,
      };
      
      const result = await pdfAutomationOrchestrator.start(runtimeConfig);
      if (result.success) {
        console.log('[GoatedApp] PDF automation started successfully');
      } else {
        console.warn('[GoatedApp] Failed to start PDF automation:', result.error);
      }
    }
  } catch (error) {
    console.error('[GoatedApp] Failed to initialize PDF automation:', error);
  }

  // Set up PDF automation event forwarding to renderer
  setupPDFAutomationEventForwarding();

  createWindow();

  // On macOS, re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle app quit
app.on('will-quit', async () => {
  // Clean up resources here
  console.log('[GoatedApp] Application is quitting...');
  
  // Shutdown AgentScheduler
  try {
    await agentScheduler.shutdown();
    console.log('[GoatedApp] AgentScheduler shutdown complete');
    console.log('[GoatedApp] Application is quitting...');
  } catch (error) {
    console.error('[GoatedApp] Failed to shutdown AgentScheduler:', error);
  }
});

// ============================================
// IPC Handlers
// ============================================

// Example IPC handler for getting app info
ipcMain.handle('app:getInfo', () => {
  return {
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    userDataPath: app.getPath('userData'),
  };
});

// Backend status - now returns AI service status instead of Python backend
ipcMain.handle('backend:status', async () => {
  const status = aiService.getStatus();
  return {
    running: status.initialized,
    pid: null,
    restartCount: 0,
    healthy: status.initialized,
    provider: status.provider,
    model: status.model,
  };
});

// Transcription handler - Requirement 4.10: IPC handler at 'transcription:transcribe'
ipcMain.handle('transcription:transcribe', async (_event, audioBuffer: ArrayBuffer) => {
  try {
    const result = await whisperService.transcribeBuffer(audioBuffer);
    return result;
  } catch (error) {
    console.error('[Transcription] Error:', error);
    throw error;
  }
});

// Get available Whisper models
ipcMain.handle('transcription:getModels', () => {
  return whisperService.getAvailableModels();
});

// Set Whisper model
ipcMain.handle('transcription:setModel', async (_event, modelName: string) => {
  try {
    await whisperService.setModel(modelName as WhisperModel);
    return { success: true };
  } catch (error) {
    console.error('[Transcription] Failed to set model:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Get current Whisper model
ipcMain.handle('transcription:getModel', () => {
  return whisperService.getModelName();
});

// Chat handler - uses AIService with MCP tools
ipcMain.handle('chat:send', async (_event, message: string) => {
  try {
    if (!aiService.isInitialized()) {
      throw new Error('AI Service not initialized. Please configure API keys in Settings.');
    }

    console.log('[Chat] Using AIService with Vercel AI SDK');
    const result = await aiService.chat(message);
    return {
      response: result.response,
      toolCalls: result.toolCalls?.map(tc => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.arguments,
        result: tc.result,
        status: tc.status,
      })),
    };
  } catch (error) {
    console.error('[Chat] Error:', error);
    throw error;
  }
});

// Clear conversation history
ipcMain.handle('chat:clear', () => {
  aiService.clearHistory();
  return { success: true };
});

// Streaming chat handler
ipcMain.handle('chat:startStream', async (_event, message: string, streamId: string) => {
  try {
    if (!aiService.isInitialized()) {
      mainWindow?.webContents.send(`chat:stream:${streamId}`, {
        type: 'error',
        data: 'AI Service not initialized. Please set GEMINI_API_KEY.',
      });
      return;
    }

    console.log('[Chat] Starting stream with Vercel AI SDK');
    
    await aiService.chatStream(message, {
      onTextChunk: (chunk: string) => {
        mainWindow?.webContents.send(`chat:stream:${streamId}`, {
          type: 'text',
          data: chunk,
        });
      },
      onToolCall: (toolCall) => {
        mainWindow?.webContents.send(`chat:stream:${streamId}`, {
          type: 'tool-call',
          data: toolCall,
        });
      },
      onToolResult: (toolCallId: string, result: string, status: 'success' | 'error') => {
        mainWindow?.webContents.send(`chat:stream:${streamId}`, {
          type: 'tool-result',
          data: { toolCallId, result, status },
        });
      },
      onComplete: (fullText: string) => {
        mainWindow?.webContents.send(`chat:stream:${streamId}`, {
          type: 'complete',
          data: fullText,
        });
      },
      onError: (error: Error) => {
        mainWindow?.webContents.send(`chat:stream:${streamId}`, {
          type: 'error',
          data: error.message,
        });
      },
    });
  } catch (error) {
    console.error('[Chat] Stream error:', error);
    mainWindow?.webContents.send(`chat:stream:${streamId}`, {
      type: 'error',
      data: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Placeholder for provider operations
ipcMain.handle('provider:list', () => {
  return [
    {
      id: 'local',
      name: 'Local (FunctionGemma)',
      type: 'local',
      baseURL: 'http://127.0.0.1:8000/v1',
      isDefault: true,
    },
  ];
});

ipcMain.handle('provider:getActive', () => {
  return {
    id: 'local',
    name: 'Local (FunctionGemma)',
    type: 'local',
    baseURL: 'http://127.0.0.1:8000/v1',
    isDefault: true,
  };
});

ipcMain.handle('provider:setActive', async (_event, _providerId: string) => {
  // Will be implemented in Provider Manager task
  return { success: true };
});

// ============================================
// MCP Operations - Model Context Protocol
// ============================================

// Connect to an MCP server by script path
ipcMain.handle('mcp:connect', async (_event, scriptPath: string) => {
  console.log('[MCP] Connect request for:', scriptPath);
  try {
    const result = await mcpService.connect(scriptPath);
    if (result.success && result.server) {
      return {
        success: true,
        server: {
          id: result.server.id,
          name: result.server.name,
          scriptPath: result.server.scriptPath,
          status: result.server.status,
          toolCount: result.server.tools.length,
          tools: result.server.tools.map(t => ({
            name: t.name,
            description: t.description,
          })),
        },
      };
    }
    return { success: false, error: result.error };
  } catch (error) {
    console.error('[MCP] Connect error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
});

// Disconnect from an MCP server
ipcMain.handle('mcp:disconnect', async (_event, serverId: string) => {
  console.log('[MCP] Disconnect request for:', serverId);
  try {
    const result = await mcpService.disconnect(serverId);
    return result;
  } catch (error) {
    console.error('[MCP] Disconnect error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
});

// List all connected MCP servers
ipcMain.handle('mcp:listServers', () => {
  const servers = mcpService.getConnectedServers();
  return servers.map(s => ({
    id: s.id,
    name: s.name,
    scriptPath: s.scriptPath,
    status: s.status,
    toolCount: s.tools.length,
    tools: s.tools.map(t => ({
      name: t.name,
      description: t.description,
    })),
    connectedAt: s.connectedAt,
  }));
});

// List all available tools from connected servers
ipcMain.handle('mcp:listTools', () => {
  return mcpService.getAllTools();
});

// Execute a tool on a connected MCP server
ipcMain.handle('mcp:executeTool', async (_event, toolName: string, args: Record<string, unknown>) => {
  console.log('[MCP] Execute tool:', toolName, args);
  try {
    const result = await mcpService.executeTool(toolName, args);
    return result;
  } catch (error) {
    console.error('[MCP] Execute tool error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
});

// Placeholder for model operations
ipcMain.handle('model:list', () => {
  return [
    {
      id: 'functiongemma',
      name: 'FunctionGemma 270M',
      type: 'llm',
      size: 270000000,
      status: 'not_downloaded',
    },
    {
      id: 'whisper-base',
      name: 'Whisper Base English',
      type: 'whisper',
      size: 142000000,
      status: 'not_downloaded',
    },
  ];
});

ipcMain.handle('model:download', async (_event, _modelId: string) => {
  // Will be implemented in Model Manager task
  return { success: false, error: 'Model download not yet implemented' };
});

ipcMain.handle('model:getDownloadProgress', async (_event, _modelId: string) => {
  return { modelId: _modelId, bytesDownloaded: 0, totalBytes: 0, percentage: 0 };
});

// API Key management
ipcMain.handle('api:setKeys', async (_event, config: { openaiApiKey?: string; geminiApiKey?: string; selectedModel?: string; provider?: 'openai' | 'gemini' | 'offline'; offlineModelPath?: string }) => {
  try {
    // Save config to file
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'api-config.json');
    const fs = await import('fs/promises');
    
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log('[API] Config saved to:', configPath);
    
    // Initialize the appropriate service
    if (config.provider === 'openai' && config.openaiApiKey) {
      aiService.initializeOpenAI(config.openaiApiKey, config.selectedModel || 'gpt-4o-mini');
      console.log('[API] OpenAI API key updated');
    } else if (config.provider === 'gemini' && config.geminiApiKey) {
      aiService.initializeGemini(config.geminiApiKey, config.selectedModel || 'gemini-2.5-flash-lite');
      console.log('[API] Gemini API key updated');
    } else if (config.openaiApiKey) {
      aiService.initializeOpenAI(config.openaiApiKey, config.selectedModel || 'gpt-4o-mini');
      console.log('[API] OpenAI API key updated (default)');
    } else if (config.geminiApiKey) {
      aiService.initializeGemini(config.geminiApiKey, config.selectedModel || 'gemini-2.5-flash-lite');
      console.log('[API] Gemini API key updated');
    }
    
    return { success: true };
  } catch (error) {
    console.error('[API] Failed to set API keys:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
});

ipcMain.handle('api:getStatus', () => {
  const status = aiService.getStatus();
  return {
    initialized: status.initialized,
    provider: status.provider,
    currentModel: status.model,
  };
});

// Offline model management
ipcMain.handle('offline:startServer', async (_event, _modelPath: string) => {
  return { success: false, error: 'Offline model not supported' };
});

ipcMain.handle('offline:stopServer', () => {
  return { success: true };
});

ipcMain.handle('offline:getStatus', () => {
  return { running: false, ready: false, modelPath: null };
});

ipcMain.handle('offline:getAvailableModels', () => {
  return [];
});

console.log('[Opax] Main process initialized');

// ============================================
// Agent Box Operations
// ============================================

// Create a new agent rule
ipcMain.handle('agent:createRule', async (_event, rule: unknown) => {
  console.log('[Agent] Create rule request');
  try {
    // Validate and save rule via renderer's AgentRuleService
    const result = await mainWindow?.webContents.executeJavaScript(`
      (async () => {
        const { AgentRuleService } = await import('./services/AgentRuleService.js');
        return await AgentRuleService.create(${JSON.stringify(rule)});
      })()
    `);

    if (result) {
      // Register with scheduler
      await agentScheduler.registerRule(result);
      return { success: true, rule: result };
    }

    return { success: false, error: 'Failed to create rule' };
  } catch (error) {
    console.error('[Agent] Create rule error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

// Update an existing agent rule
ipcMain.handle('agent:updateRule', async (_event, ruleId: string, updates: unknown) => {
  console.log('[Agent] Update rule request:', ruleId);
  try {
    // Update rule via renderer's AgentRuleService
    const result = await mainWindow?.webContents.executeJavaScript(`
      (async () => {
        const { AgentRuleService } = await import('./services/AgentRuleService.js');
        return await AgentRuleService.update('${ruleId}', ${JSON.stringify(updates)});
      })()
    `);

    if (result) {
      // Re-register with scheduler if active
      if (result.is_active) {
        await agentScheduler.unregisterRule(ruleId);
        await agentScheduler.registerRule(result);
      }
      return { success: true, rule: result };
    }

    return { success: false, error: 'Rule not found' };
  } catch (error) {
    console.error('[Agent] Update rule error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

// Delete an agent rule
ipcMain.handle('agent:deleteRule', async (_event, ruleId: string) => {
  console.log('[Agent] Delete rule request:', ruleId);
  try {
    // Unregister from scheduler first
    await agentScheduler.unregisterRule(ruleId);

    // Delete from database
    const result = await mainWindow?.webContents.executeJavaScript(`
      (async () => {
        const { AgentRuleService } = await import('./services/AgentRuleService.js');
        return await AgentRuleService.delete('${ruleId}');
      })()
    `);

    return { success: result };
  } catch (error) {
    console.error('[Agent] Delete rule error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

// Toggle rule active status
ipcMain.handle('agent:toggleRule', async (_event, ruleId: string) => {
  console.log('[Agent] Toggle rule request:', ruleId);
  try {
    // Toggle via renderer's AgentRuleService
    const result = await mainWindow?.webContents.executeJavaScript(`
      (async () => {
        const { AgentRuleService } = await import('./services/AgentRuleService.js');
        return await AgentRuleService.toggleActive('${ruleId}');
      })()
    `);

    if (result) {
      // Register or unregister based on new state
      if (result.is_active) {
        await agentScheduler.registerRule(result);
      } else {
        await agentScheduler.unregisterRule(ruleId);
      }
      return { success: true, rule: result };
    }

    return { success: false, error: 'Rule not found' };
  } catch (error) {
    console.error('[Agent] Toggle rule error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

// List all agent rules
ipcMain.handle('agent:listRules', async () => {
  console.log('[Agent] List rules request');
  try {
    const rules = await mainWindow?.webContents.executeJavaScript(`
      (async () => {
        const { AgentRuleService } = await import('./services/AgentRuleService.js');
        return await AgentRuleService.getAll();
      })()
    `);

    return { success: true, rules: rules || [] };
  } catch (error) {
    console.error('[Agent] List rules error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      rules: []
    };
  }
});

// Get logs for a specific rule
ipcMain.handle('agent:getRuleLogs', async (_event, ruleId: string) => {
  console.log('[Agent] Get rule logs request:', ruleId);
  try {
    const logger = (await import('./services/AgentLogger')).AgentLogger.getInstance();
    const logs = logger.getAgentLogs(ruleId);
    return { success: true, logs };
  } catch (error) {
    console.error('[Agent] Get rule logs error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      logs: []
    };
  }
});

// ============================================
// PDF Automation Operations
// ============================================

/**
 * Set up event forwarding from PDFAutomationOrchestrator to renderer
 * Forwards processing-started, processing-completed, processing-failed, and status-changed events
 */
function setupPDFAutomationEventForwarding(): void {
  console.log('[PDFAutomation] Setting up event forwarding to renderer');

  // Forward processing-started event
  pdfAutomationOrchestrator.on('processing-started', (entry: ProcessingHistoryEntry) => {
    console.log('[PDFAutomation] Forwarding processing-started event:', entry.filename);
    mainWindow?.webContents.send('pdf-automation:processing-started', entry);
  });

  // Forward processing-completed event
  pdfAutomationOrchestrator.on('processing-completed', (entry: ProcessingHistoryEntry) => {
    console.log('[PDFAutomation] Forwarding processing-completed event:', entry.filename);
    mainWindow?.webContents.send('pdf-automation:processing-completed', entry);
  });

  // Forward processing-failed event
  pdfAutomationOrchestrator.on('processing-failed', (entry: ProcessingHistoryEntry) => {
    console.log('[PDFAutomation] Forwarding processing-failed event:', entry.filename);
    mainWindow?.webContents.send('pdf-automation:processing-failed', entry);
  });

  // Forward status-changed event
  pdfAutomationOrchestrator.on('status-changed', (status) => {
    console.log('[PDFAutomation] Forwarding status-changed event');
    mainWindow?.webContents.send('pdf-automation:status-changed', status);
  });

  // Forward warning event
  pdfAutomationOrchestrator.on('warning', (warning) => {
    console.log('[PDFAutomation] Forwarding warning event:', warning.message);
    mainWindow?.webContents.send('pdf-automation:warning', warning);
  });
}

// Configure and start PDF automation
ipcMain.handle('pdf-automation:configure', async (_event, config: AutomationConfig) => {
  console.log('[PDFAutomation] Configure request:', {
    directoryPath: config.directoryPath,
    recipientEmail: config.recipientEmail,
    enabled: config.enabled,
    hasSmtpConfig: !!config.smtpConfig,
  });

  try {
    // Save config to store
    const saveResult = await automationConfigStore.save({
      directoryPath: config.directoryPath,
      recipientEmail: config.recipientEmail,
      enabled: config.enabled,
      smtpConfig: config.smtpConfig ? {
        host: config.smtpConfig.host,
        port: config.smtpConfig.port,
        secure: config.smtpConfig.secure,
        user: config.smtpConfig.auth.user,
        pass: config.smtpConfig.auth.pass,
      } : undefined,
    });

    if (!saveResult.success) {
      return { success: false, error: saveResult.error };
    }

    // Start the orchestrator if enabled
    if (config.enabled) {
      const startResult = await pdfAutomationOrchestrator.start(config);
      return startResult;
    } else {
      // Stop if disabled
      await pdfAutomationOrchestrator.stop();
      return { success: true };
    }
  } catch (error) {
    console.error('[PDFAutomation] Configure error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Start PDF automation (load config from store and start)
ipcMain.handle('pdf-automation:start', async () => {
  console.log('[PDFAutomation] Start request');

  try {
    // Load config from store
    const savedConfig = await automationConfigStore.load();
    if (!savedConfig) {
      return { success: false, error: 'No saved configuration found. Please configure first.' };
    }

    // Convert persisted config to runtime config
    const runtimeConfig: AutomationConfig = {
      directoryPath: savedConfig.directoryPath,
      recipientEmail: savedConfig.recipientEmail,
      enabled: true, // Force enabled when starting
      smtpConfig: savedConfig.smtpConfig ? {
        host: savedConfig.smtpConfig.host,
        port: savedConfig.smtpConfig.port,
        secure: savedConfig.smtpConfig.secure,
        auth: {
          user: savedConfig.smtpConfig.user,
          pass: savedConfig.smtpConfig.pass,
        },
      } : undefined,
    };

    // Start the orchestrator
    const result = await pdfAutomationOrchestrator.start(runtimeConfig);

    // Update saved config to reflect enabled state
    if (result.success) {
      await automationConfigStore.save({
        directoryPath: savedConfig.directoryPath,
        recipientEmail: savedConfig.recipientEmail,
        enabled: true,
        smtpConfig: savedConfig.smtpConfig ? {
          host: savedConfig.smtpConfig.host,
          port: savedConfig.smtpConfig.port,
          secure: savedConfig.smtpConfig.secure,
          user: savedConfig.smtpConfig.user,
          pass: savedConfig.smtpConfig.pass,
        } : undefined,
      });
    }

    return result;
  } catch (error) {
    console.error('[PDFAutomation] Start error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Stop PDF automation
ipcMain.handle('pdf-automation:stop', async () => {
  console.log('[PDFAutomation] Stop request');

  try {
    await pdfAutomationOrchestrator.stop();

    // Update saved config to reflect disabled state
    const savedConfig = await automationConfigStore.load();
    if (savedConfig) {
      await automationConfigStore.save({
        directoryPath: savedConfig.directoryPath,
        recipientEmail: savedConfig.recipientEmail,
        enabled: false,
        smtpConfig: savedConfig.smtpConfig ? {
          host: savedConfig.smtpConfig.host,
          port: savedConfig.smtpConfig.port,
          secure: savedConfig.smtpConfig.secure,
          user: savedConfig.smtpConfig.user,
          pass: savedConfig.smtpConfig.pass,
        } : undefined,
      });
    }

    return { success: true };
  } catch (error) {
    console.error('[PDFAutomation] Stop error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Get current automation status
ipcMain.handle('pdf-automation:getStatus', () => {
  console.log('[PDFAutomation] GetStatus request');
  return pdfAutomationOrchestrator.getStatus();
});

// Get processing history
ipcMain.handle('pdf-automation:getHistory', (_event, limit?: number) => {
  console.log('[PDFAutomation] GetHistory request, limit:', limit);
  return pdfAutomationOrchestrator.getHistory(limit);
});

// Clear processing history
ipcMain.handle('pdf-automation:clearHistory', () => {
  console.log('[PDFAutomation] ClearHistory request');
  pdfAutomationOrchestrator.clearHistory();
  return { success: true };
});

// Open native directory picker dialog
ipcMain.handle('pdf-automation:selectDirectory', async () => {
  console.log('[PDFAutomation] SelectDirectory request');

  try {
    const result = await dialog.showOpenDialog({
      title: 'Select Directory to Watch for PDFs',
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Select Folder',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    return {
      canceled: false,
      path: result.filePaths[0],
    };
  } catch (error) {
    console.error('[PDFAutomation] SelectDirectory error:', error);
    return {
      canceled: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Get saved automation configuration
ipcMain.handle('pdf-automation:getConfig', async () => {
  console.log('[PDFAutomation] GetConfig request');

  try {
    const savedConfig = await automationConfigStore.load();
    if (!savedConfig) {
      return { success: true, config: null };
    }

    // Return config without sensitive password data
    return {
      success: true,
      config: {
        directoryPath: savedConfig.directoryPath,
        recipientEmail: savedConfig.recipientEmail,
        enabled: savedConfig.enabled,
        smtpConfigured: !!savedConfig.smtpConfig,
        smtpHost: savedConfig.smtpConfig?.host,
        smtpPort: savedConfig.smtpConfig?.port,
        smtpUser: savedConfig.smtpConfig?.user,
      },
    };
  } catch (error) {
    console.error('[PDFAutomation] GetConfig error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// ============================================
// Email Configuration Operations
// ============================================

// Configure email service with SMTP settings
ipcMain.handle('email:configure', async (_event, config: SMTPConfig) => {
  console.log('[Email] Configure request:', {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.auth?.user,
  });

  try {
    const result = await emailService.configure(config);
    return result;
  } catch (error) {
    console.error('[Email] Configure error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Test SMTP connection
ipcMain.handle('email:testConnection', async () => {
  console.log('[Email] TestConnection request');

  try {
    const result = await emailService.testConnection();
    return result;
  } catch (error) {
    console.error('[Email] TestConnection error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Check if email is configured
ipcMain.handle('email:isConfigured', () => {
  console.log('[Email] IsConfigured request');
  return emailService.isConfigured();
});

// Get email configuration status (without sensitive data)
ipcMain.handle('email:getConfigStatus', () => {
  console.log('[Email] GetConfigStatus request');
  return emailService.getConfigStatus();
});

// Get SMTP presets for common providers
ipcMain.handle('email:getPresets', () => {
  console.log('[Email] GetPresets request');
  const { EmailService: ES } = require('./services/EmailService');
  return ES.getPresets();
});