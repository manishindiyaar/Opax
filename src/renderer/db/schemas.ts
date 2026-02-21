/**
 * RxDB Schema Definitions for Chat Persistence and Agent Box
 * Requirements: 1.4, 5.1, 5.3 (Chat), 1.1, 1.4, 1.6 (Agent Box)
 */

import { RxJsonSchema } from 'rxdb';

// Tool call data structure for assistant messages
export interface ToolCallData {
  id: string;
  name: string;
  arguments: string;
  status: 'pending' | 'success' | 'error';
  result?: string;
}

// Conversation document interface
export interface ConversationDocument {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  preview: string;
}

// Message document interface
export interface MessageDocument {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  toolCalls?: ToolCallData[];
}

// Conversation schema with validation
export const conversationSchema: RxJsonSchema<ConversationDocument> = {
  version: 0,
  title: 'conversation schema',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    title: { type: 'string', maxLength: 200 },
    createdAt: { type: 'number' },
    updatedAt: { type: 'number' },
    preview: { type: 'string', maxLength: 500 }
  },
  required: ['id', 'title', 'createdAt', 'updatedAt', 'preview'],
  indexes: ['updatedAt']
};

// Message schema with validation
export const messageSchema: RxJsonSchema<MessageDocument> = {
  version: 0,
  title: 'message schema',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    conversationId: { type: 'string', maxLength: 36 },
    role: { type: 'string', enum: ['user', 'assistant', 'tool'], maxLength: 10 },
    content: { type: 'string' },
    timestamp: { type: 'number' },
    toolCalls: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          arguments: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'success', 'error'] },
          result: { type: 'string' }
        },
        required: ['id', 'name', 'arguments', 'status']
      }
    }
  },
  required: ['id', 'conversationId', 'role', 'content', 'timestamp'],
  indexes: ['conversationId', 'timestamp', ['conversationId', 'timestamp']]
};

// Agent Rule Schema (duplicated from shared for Vite compatibility)
// Original: src/shared/schema/agent_rules.ts

export type JsonLogicRule = Record<string, unknown>;

export interface PollingConfig {
  mcp_server: string;
  tool_name: string;
  interval_seconds: number;
  cursor_field: string;
}

export interface WorkflowStep {
  id: string;
  type: 'action' | 'condition';
  mcp_server?: string;
  tool_name?: string;
  args_template?: Record<string, unknown>;
  condition_rule?: JsonLogicRule;
}

export interface AgentRuleDocument {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  trigger_type: 'cron' | 'event';
  cron_expression?: string;
  polling_config?: PollingConfig;
  steps: WorkflowStep[];
  last_run_status: 'success' | 'failed' | 'pending' | null;
  last_cursor_value?: string;
  last_run_at?: number;
  consecutive_failures: number;
  created_at: number;
  updated_at: number;
}

export const agentRuleSchema: RxJsonSchema<AgentRuleDocument> = {
  version: 0,
  title: 'agent_rule schema',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    name: { type: 'string', maxLength: 200 },
    description: { type: 'string', maxLength: 1000 },
    is_active: { type: 'boolean' },
    trigger_type: { type: 'string', enum: ['cron', 'event'] },
    cron_expression: { type: 'string', maxLength: 50 },
    polling_config: {
      type: 'object',
      properties: {
        mcp_server: { type: 'string' },
        tool_name: { type: 'string' },
        interval_seconds: { type: 'number', minimum: 10 },
        cursor_field: { type: 'string' }
      }
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['action', 'condition'] },
          mcp_server: { type: 'string' },
          tool_name: { type: 'string' },
          args_template: { type: 'object' },
          condition_rule: { type: 'object' }
        },
        required: ['id', 'type']
      }
    },
    last_run_status: { 
      type: ['string', 'null'],
      enum: ['success', 'failed', 'pending', null] 
    },
    last_cursor_value: { type: 'string' },
    last_run_at: { type: 'number' },
    consecutive_failures: { type: 'number', minimum: 0 },
    created_at: { type: 'number' },
    updated_at: { type: 'number' }
  },
  required: ['id', 'name', 'trigger_type', 'steps', 'is_active', 'consecutive_failures', 'created_at', 'updated_at']
};



// User settings document
export interface UserSettingsDocument {
  id: string;
  userName: string;
  createdAt: number;
  updatedAt: number;
}

export const userSettingsSchema: RxJsonSchema<UserSettingsDocument> = {
  version: 0,
  title: 'user_settings schema',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    userName: { type: 'string', maxLength: 100 },
    createdAt: { type: 'number' },
    updatedAt: { type: 'number' }
  },
  required: ['id', 'userName', 'createdAt', 'updatedAt']
};
