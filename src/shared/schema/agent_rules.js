"use strict";
/**
 * Agent Box Schema Definitions
 * Requirements: 1.1, 1.4, 1.6
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentRuleSchema = void 0;
// Agent Rule RxDB schema with validation
exports.agentRuleSchema = {
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
//# sourceMappingURL=agent_rules.js.map