/**
 * Agent Box Schema Definitions
 * Requirements: 1.1, 1.4, 1.6
 */

import { RxJsonSchema } from 'rxdb';

// JSON Logic rule type for safe condition evaluation
export type JsonLogicRule = Record<string, unknown>;

// Polling configuration for event-based triggers
export interface PollingConfig {
  mcp_server: string;      // Server ID
  tool_name: string;       // Tool to poll
  interval_seconds: number; // Min: 10
  cursor_field: string;    // Field to track (e.g., "id")
}

// Workflow step definition
export interface WorkflowStep {
  id: string;                    // Step identifier (e.g., "step1")
  type: 'action' | 'condition';
  
  // Action Configuration
  mcp_server?: string;
  tool_name?: string;
  args_template?: Record<string, unknown>;  // Handlebars templates
  
  // Condition Configuration
  condition_rule?: JsonLogicRule;
}

// Agent Rule document interface
export interface AgentRuleDocument {
  id: string;                    // UUID primary key
  name: string;                  // User-friendly name
  description: string;           // Natural language description
  is_active: boolean;            // Enable/disable toggle
  
  // Trigger Configuration
  trigger_type: 'cron' | 'event';
  cron_expression?: string;      // e.g., "30 8 * * *"
  polling_config?: PollingConfig;
  
  // Workflow Steps
  steps: WorkflowStep[];
  
  // State Tracking
  last_run_status: 'success' | 'failed' | 'pending' | null;
  last_cursor_value?: string;
  last_run_at?: number;
  consecutive_failures: number;
  
  // Metadata
  created_at: number;
  updated_at: number;
}

// Agent Rule RxDB schema with validation
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
