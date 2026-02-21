/**
 * Agent Box Schema Definitions
 * Requirements: 1.1, 1.4, 1.6
 */
import { RxJsonSchema } from 'rxdb';
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
export declare const agentRuleSchema: RxJsonSchema<AgentRuleDocument>;
//# sourceMappingURL=agent_rules.d.ts.map