/**
 * AIService - AI Chat Service using Vercel AI SDK
 *
 * Provides chat functionality with OpenAI and Gemini with automatic tool execution
 * via connected MCP servers. Supports streaming and non-streaming modes.
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText, stepCountIs } from 'ai';
import { tool } from '@ai-sdk/provider-utils';
import { z } from 'zod';
import { getMCPService, MCPTool } from './MCPService';

// Types
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCallInfo[];
}

export interface ToolCallInfo {
  id: string;
  name: string;
  arguments: string;
  result?: string;
  status: 'pending' | 'success' | 'error';
}

export interface ChatResult {
  response: string;
  toolCalls?: ToolCallInfo[];
}

export interface StreamCallbacks {
  onTextChunk: (chunk: string) => void;
  onToolCall: (toolCall: ToolCallInfo) => void;
  onToolResult: (toolCallId: string, result: string, status: 'success' | 'error') => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

// Callback for human-in-the-loop: waits for user to fill a form before AI continues
export type FormSubmitResolver = (result: { success: boolean; result?: unknown; error?: string }) => void;

export type AIProvider = 'openai' | 'gemini';

class AIService {
  private static instance: AIService;
  private openai: ReturnType<typeof createOpenAI> | null = null;
  private google: ReturnType<typeof createGoogleGenerativeAI> | null = null;
  private currentProvider: AIProvider = 'openai';
  private currentModel: string = 'gpt-4o-mini';
  private conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

  // Human-in-the-loop: pending form submissions keyed by toolCallId
  private pendingFormResolvers = new Map<string, FormSubmitResolver>();

  private readonly systemPrompt = `You are Opax, a clinical assistant for healthcare staff. You help manage patients, staff, appointments, and lab tests.

IMPORTANT RULES FOR CREATION/ADD OPERATIONS:
- When the user wants to CREATE, ADD, or REGISTER a new patient, staff member, doctor, appointment, or lab test, call the appropriate tool with NO arguments (empty object {}).
- The server will return a form for the user to fill in. Do NOT fabricate or guess any details like names, emails, phone numbers, or dates.
- Only pass arguments to creation tools if the user has explicitly provided those specific values in their message.
- For example: "add a new doctor" → call create_staff with {} (empty). "add doctor named John Smith with phone 555-1234" → call create_staff with {"name":"John Smith","phone":"555-1234"}.

For all other tools (list, get, search, update, etc.), pass the arguments normally.`;

  private constructor() {}

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  initializeOpenAI(apiKey: string, model: string = 'gpt-4o-mini'): void {
    this.openai = createOpenAI({ apiKey });
    this.google = null;
    this.currentProvider = 'openai';
    this.currentModel = model;
    console.log('[AIService] Initialized with OpenAI model:', model);
  }

  initializeGemini(apiKey: string, model: string = 'gemini-2.5-flash-lite'): void {
    this.google = createGoogleGenerativeAI({ apiKey });
    this.openai = null;
    this.currentProvider = 'gemini';
    this.currentModel = model;
    console.log('[AIService] Initialized with Gemini model:', model);
  }

  setModel(model: string): void {
    this.currentModel = model;
    console.log('[AIService] Model changed to:', model);
  }

  getStatus(): { provider: AIProvider; model: string; initialized: boolean } {
    return {
      provider: this.currentProvider,
      model: this.currentModel,
      initialized: this.isInitialized(),
    };
  }

  isInitialized(): boolean {
    return this.openai !== null || this.google !== null;
  }

  private getModel(): any {
    if (this.currentProvider === 'openai' && this.openai) {
      return this.openai(this.currentModel);
    }
    if (this.currentProvider === 'gemini' && this.google) {
      return this.google(this.currentModel);
    }
    throw new Error('AI Service not initialized');
  }

  private convertMCPToolsToAITools(mcpTools: MCPTool[], toolCallTracker: ToolCallInfo[]): Record<string, any> {
    const tools: Record<string, any> = {};
    const mcpService = getMCPService();

    for (const mcpTool of mcpTools) {
      tools[mcpTool.name] = tool({
        description: mcpTool.description,
        inputSchema: z.object(this.convertJsonSchemaToZod(mcpTool.inputSchema)),
        execute: async (args: Record<string, unknown>) => {
          const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
          const toolCallInfo: ToolCallInfo = {
            id: callId,
            name: mcpTool.name,
            arguments: JSON.stringify(args, null, 2),
            status: 'pending',
          };
          toolCallTracker.push(toolCallInfo);

          try {
            const result = await mcpService.executeTool(mcpTool.name, args);
            if (result.success) {
              const resultStr = typeof result.result === 'string'
                ? result.result
                : JSON.stringify(result.result, null, 2);
              toolCallInfo.result = resultStr;
              toolCallInfo.status = 'success';
              return result.result;
            }
            toolCallInfo.result = result.error || 'Tool execution failed';
            toolCallInfo.status = 'error';
            throw new Error(result.error || 'Tool execution failed');
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            toolCallInfo.result = errorMsg;
            toolCallInfo.status = 'error';
            throw error;
          }
        },
      });
    }

    return tools;
  }

  private convertMCPToolsToAIToolsWithCallbacks(
    mcpTools: MCPTool[],
    toolCallTracker: ToolCallInfo[],
    callbacks: StreamCallbacks
  ): Record<string, any> {
    const tools: Record<string, any> = {};
    const mcpService = getMCPService();

    for (const mcpTool of mcpTools) {
      tools[mcpTool.name] = tool({
        description: mcpTool.description,
        inputSchema: z.object(this.convertJsonSchemaToZod(mcpTool.inputSchema)),
        execute: async (args: Record<string, unknown>) => {
          const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
          const toolCallInfo: ToolCallInfo = {
            id: callId,
            name: mcpTool.name,
            arguments: JSON.stringify(args, null, 2),
            status: 'pending',
          };
          toolCallTracker.push(toolCallInfo);
          callbacks.onToolCall(toolCallInfo);

          try {
            const result = await mcpService.executeTool(mcpTool.name, args);
            if (result.success) {
              const resultStr = typeof result.result === 'string'
                ? result.result
                : JSON.stringify(result.result, null, 2);

              // Check if the server returned a form-card (human-in-the-loop)
              let parsed: any = null;
              try {
                parsed = typeof result.result === 'string' ? JSON.parse(result.result) : result.result;
              } catch { /* not JSON, that's fine */ }

              if (parsed?.metadata?.componentType === 'form-card' && parsed?.metadata?.formSchema) {
                console.log(`[AIService] Form-card detected for ${mcpTool.name}, pausing for user input (callId: ${callId})`);
                // Send the form-card result to renderer so it renders the form
                toolCallInfo.result = resultStr;
                toolCallInfo.status = 'success';
                callbacks.onToolResult(callId, resultStr, 'success');

                // Now WAIT for the user to fill and submit the form
                const formResult = await new Promise<{ success: boolean; result?: unknown; error?: string }>((resolve) => {
                  this.pendingFormResolvers.set(callId, resolve);
                });

                console.log(`[AIService] Form submitted by user for callId: ${callId}`, formResult);

                // Return the form submission result to the AI as the tool's final result
                if (formResult.success) {
                  const formResultStr = typeof formResult.result === 'string'
                    ? formResult.result
                    : JSON.stringify(formResult.result, null, 2);
                  // Update the tool call info with the actual creation result
                  toolCallInfo.result = formResultStr;
                  callbacks.onToolResult(callId, formResultStr, 'success');
                  return formResult.result;
                } else {
                  const errMsg = formResult.error || 'User form submission failed';
                  toolCallInfo.result = errMsg;
                  toolCallInfo.status = 'error';
                  callbacks.onToolResult(callId, errMsg, 'error');
                  throw new Error(errMsg);
                }
              }

              toolCallInfo.result = resultStr;
              toolCallInfo.status = 'success';
              callbacks.onToolResult(callId, resultStr, 'success');
              return result.result;
            }
            const errorMsg = result.error || 'Tool execution failed';
            toolCallInfo.result = errorMsg;
            toolCallInfo.status = 'error';
            callbacks.onToolResult(callId, errorMsg, 'error');
            throw new Error(errorMsg);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            toolCallInfo.result = errorMsg;
            toolCallInfo.status = 'error';
            callbacks.onToolResult(callId, errorMsg, 'error');
            throw error;
          }
        },
      });
    }

    return tools;
  }

  private convertJsonSchemaToZod(schema: Record<string, unknown>): Record<string, z.ZodTypeAny> {
    const zodSchema: Record<string, z.ZodTypeAny> = {};
    const properties = schema.properties as Record<string, { type?: string; description?: string }> | undefined;
    const required = schema.required as string[] | undefined;

    if (properties) {
      for (const [key, prop] of Object.entries(properties)) {
        let zodType: z.ZodTypeAny;

        switch (prop.type) {
          case 'string': zodType = z.string(); break;
          case 'number':
          case 'integer': zodType = z.number(); break;
          case 'boolean': zodType = z.boolean(); break;
          case 'array': zodType = z.array(z.unknown()); break;
          case 'object': zodType = z.record(z.string(), z.unknown()); break;
          default: zodType = z.unknown();
        }

        if (prop.description) zodType = zodType.describe(prop.description);
        if (!required?.includes(key)) zodType = zodType.optional();
        zodSchema[key] = zodType;
      }
    }

    return zodSchema;
  }

  async chat(userMessage: string): Promise<ChatResult> {
    if (!this.isInitialized()) {
      throw new Error('AI Service not initialized. Please configure API keys in Settings.');
    }

    const mcpService = getMCPService();
    const mcpTools = mcpService.getAllTools();
    const toolCalls: ToolCallInfo[] = [];

    this.conversationHistory.push({ role: 'user', content: userMessage });

    try {
      const tools = mcpTools.length > 0
        ? this.convertMCPToolsToAITools(mcpTools, toolCalls)
        : undefined;

      const result = await generateText({
        model: this.getModel(),
        messages: [
          { role: 'system', content: this.systemPrompt },
          ...this.conversationHistory,
        ],
        tools,
        stopWhen: stepCountIs(5),
      });

      const responseText = result.text || '';
      if (responseText) {
        this.conversationHistory.push({ role: 'assistant', content: responseText });
      }

      return {
        response: responseText,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } catch (error) {
      for (const tc of toolCalls) {
        if (tc.status === 'pending') {
          tc.status = 'error';
          tc.result = error instanceof Error ? error.message : 'Unknown error';
        }
      }
      throw error;
    }
  }

  async chatStream(userMessage: string, callbacks: StreamCallbacks): Promise<void> {
    if (!this.isInitialized()) {
      callbacks.onError(new Error('AI Service not initialized. Please configure API keys in Settings.'));
      return;
    }

    const mcpService = getMCPService();
    const mcpTools = mcpService.getAllTools();
    const toolCalls: ToolCallInfo[] = [];

    this.conversationHistory.push({ role: 'user', content: userMessage });

    try {
      const tools = mcpTools.length > 0
        ? this.convertMCPToolsToAIToolsWithCallbacks(mcpTools, toolCalls, callbacks)
        : undefined;

      // Build messages with system prompt
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: this.systemPrompt },
        ...this.conversationHistory,
      ];

      const result = streamText({
        model: this.getModel(),
        messages,
        tools,
        stopWhen: stepCountIs(5),
      });

      let fullText = '';
      for await (const chunk of result.textStream) {
        fullText += chunk;
        callbacks.onTextChunk(chunk);
      }

      await result;

      if (fullText) {
        this.conversationHistory.push({ role: 'assistant', content: fullText });
      }

      callbacks.onComplete(fullText);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      for (const tc of toolCalls) {
        if (tc.status === 'pending') {
          tc.status = 'error';
          tc.result = errorMessage;
          callbacks.onToolResult(tc.id, errorMessage, 'error');
        }
      }
      callbacks.onError(error instanceof Error ? error : new Error(errorMessage));
    }
  }

  clearHistory(): void {
    this.conversationHistory = [];
    console.log('[AIService] Conversation history cleared');
  }

  getHistory(): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
    return [...this.conversationHistory];
  }

  /**
   * Human-in-the-loop: resolve a pending form submission.
   * Called from the IPC handler when the user submits a form in the renderer.
   */
  resolveFormSubmission(toolCallId: string, result: { success: boolean; result?: unknown; error?: string }): boolean {
    const resolver = this.pendingFormResolvers.get(toolCallId);
    if (resolver) {
      console.log(`[AIService] Resolving form for toolCallId: ${toolCallId}`);
      this.pendingFormResolvers.delete(toolCallId);
      resolver(result);
      return true;
    }
    console.warn(`[AIService] No pending form found for toolCallId: ${toolCallId}`);
    return false;
  }

  /** Check if there's a pending form waiting for user input */
  hasPendingForm(): boolean {
    return this.pendingFormResolvers.size > 0;
  }
}

export function getAIService(): AIService {
  return AIService.getInstance();
}

export default AIService;
