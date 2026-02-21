/**
 * Unit Tests: WorkflowExecutor.execute()
 * 
 * Tests the full workflow execution method
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkflowExecutor, AgentRule, WorkflowStep } from '../../src/main/services/WorkflowExecutor';
import * as MCPService from '../../src/main/services/MCPService';
import * as AgentLoggerModule from '../../src/main/services/AgentLogger';

describe('WorkflowExecutor.execute()', () => {
  beforeEach(() => {
    // Mock MCP service
    vi.mock('../../src/main/services/MCPService', () => ({
      getMCPService: vi.fn(() => ({
        executeTool: vi.fn()
      }))
    }));

    // Mock AgentLogger
    vi.mock('../../src/main/services/AgentLogger', () => ({
      AgentLogger: {
        getInstance: vi.fn(() => ({
          trigger: vi.fn(),
          info: vi.fn(),
          success: vi.fn(),
          error: vi.fn()
        }))
      }
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should execute a simple workflow with one action step', async () => {
    const rule: AgentRule = {
      id: 'test-rule-1',
      name: 'Test Rule',
      steps: [
        {
          id: 'step1',
          type: 'action',
          mcp_server: 'test-server',
          tool_name: 'test-tool',
          args_template: { value: 'test' }
        }
      ]
    };

    // Mock MCP service to return success
    const mockExecuteTool = vi.fn().mockResolvedValue({
      success: true,
      result: { data: 'result1' }
    });

    vi.mocked(MCPService.getMCPService).mockReturnValue({
      executeTool: mockExecuteTool
    } as any);

    const result = await WorkflowExecutor.execute(rule);

    expect(result.success).toBe(true);
    expect(result.steps.step1).toBeDefined();
    expect(result.steps.step1.success).toBe(true);
    expect(result.steps.step1.data).toEqual({ data: 'result1' });
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should execute multiple steps in sequence', async () => {
    const rule: AgentRule = {
      id: 'test-rule-2',
      name: 'Multi-Step Rule',
      steps: [
        {
          id: 'step1',
          type: 'action',
          mcp_server: 'test-server',
          tool_name: 'get-data',
          args_template: {}
        },
        {
          id: 'step2',
          type: 'action',
          mcp_server: 'test-server',
          tool_name: 'process-data',
          args_template: { input: '{{step1}}' }
        }
      ]
    };

    const mockExecuteTool = vi.fn()
      .mockResolvedValueOnce({
        success: true,
        result: 'data1'
      })
      .mockResolvedValueOnce({
        success: true,
        result: 'processed-data1'
      });

    vi.mocked(MCPService.getMCPService).mockReturnValue({
      executeTool: mockExecuteTool
    } as any);

    const result = await WorkflowExecutor.execute(rule);

    expect(result.success).toBe(true);
    expect(result.steps.step1.success).toBe(true);
    expect(result.steps.step2.success).toBe(true);
    expect(mockExecuteTool).toHaveBeenCalledTimes(2);
  });

  it('should stop execution on step failure', async () => {
    const rule: AgentRule = {
      id: 'test-rule-3',
      name: 'Failing Rule',
      steps: [
        {
          id: 'step1',
          type: 'action',
          mcp_server: 'test-server',
          tool_name: 'failing-tool',
          args_template: {}
        },
        {
          id: 'step2',
          type: 'action',
          mcp_server: 'test-server',
          tool_name: 'should-not-run',
          args_template: {}
        }
      ]
    };

    const mockExecuteTool = vi.fn()
      .mockResolvedValueOnce({
        success: false,
        error: 'Tool execution failed'
      });

    vi.mocked(MCPService.getMCPService).mockReturnValue({
      executeTool: mockExecuteTool
    } as any);

    const result = await WorkflowExecutor.execute(rule);

    expect(result.success).toBe(false);
    expect(result.error).toContain('step1 failed');
    expect(result.steps.step1.success).toBe(false);
    expect(result.steps.step2).toBeUndefined(); // Step 2 should not execute
    expect(mockExecuteTool).toHaveBeenCalledTimes(1); // Only step1 executed
  });

  it('should include trigger data in execution context', async () => {
    const rule: AgentRule = {
      id: 'test-rule-4',
      name: 'Trigger Data Rule',
      steps: [
        {
          id: 'step1',
          type: 'action',
          mcp_server: 'test-server',
          tool_name: 'use-trigger',
          args_template: { value: '{{trigger.data}}' }
        }
      ]
    };

    const mockExecuteTool = vi.fn().mockResolvedValue({
      success: true,
      result: 'processed'
    });

    vi.mocked(MCPService.getMCPService).mockReturnValue({
      executeTool: mockExecuteTool
    } as any);

    const triggerData = { data: 'trigger-value' };
    const result = await WorkflowExecutor.execute(rule, triggerData);

    expect(result.success).toBe(true);
    // Verify trigger data was hydrated in args
    const callArgs = mockExecuteTool.mock.calls[0][1];
    expect(callArgs.value).toBe('trigger-value');
  });

  it('should handle condition steps', async () => {
    const rule: AgentRule = {
      id: 'test-rule-5',
      name: 'Condition Rule',
      steps: [
        {
          id: 'condition1',
          type: 'condition',
          condition_rule: { '==': [1, 1] }
        }
      ]
    };

    const result = await WorkflowExecutor.execute(rule);

    expect(result.success).toBe(true);
    expect(result.steps.condition1.success).toBe(true);
    expect(result.steps.condition1.data).toBe(true);
  });

  it('should make step results available to subsequent steps', async () => {
    const rule: AgentRule = {
      id: 'test-rule-6',
      name: 'Context Building Rule',
      steps: [
        {
          id: 'step1',
          type: 'action',
          mcp_server: 'test-server',
          tool_name: 'get-value',
          args_template: {}
        },
        {
          id: 'step2',
          type: 'action',
          mcp_server: 'test-server',
          tool_name: 'use-value',
          args_template: { previous: '{{step1}}' }
        }
      ]
    };

    const mockExecuteTool = vi.fn()
      .mockResolvedValueOnce({
        success: true,
        result: 42
      })
      .mockResolvedValueOnce({
        success: true,
        result: 'used-42'
      });

    vi.mocked(MCPService.getMCPService).mockReturnValue({
      executeTool: mockExecuteTool
    } as any);

    const result = await WorkflowExecutor.execute(rule);

    expect(result.success).toBe(true);
    
    // Verify step2 received step1's result
    const step2Args = mockExecuteTool.mock.calls[1][1];
    expect(step2Args.previous).toBe('42'); // Hydrated from step1 result
  });

  it('should handle workflow with no trigger data', async () => {
    const rule: AgentRule = {
      id: 'test-rule-7',
      name: 'No Trigger Rule',
      steps: [
        {
          id: 'step1',
          type: 'action',
          mcp_server: 'test-server',
          tool_name: 'simple-tool',
          args_template: {}
        }
      ]
    };

    const mockExecuteTool = vi.fn().mockResolvedValue({
      success: true,
      result: 'done'
    });

    vi.mocked(MCPService.getMCPService).mockReturnValue({
      executeTool: mockExecuteTool
    } as any);

    const result = await WorkflowExecutor.execute(rule);

    expect(result.success).toBe(true);
    expect(result.steps.step1.success).toBe(true);
  });

  it('should log workflow execution events', async () => {
    const rule: AgentRule = {
      id: 'test-rule-8',
      name: 'Logging Rule',
      steps: [
        {
          id: 'step1',
          type: 'action',
          mcp_server: 'test-server',
          tool_name: 'test-tool',
          args_template: {}
        }
      ]
    };

    const mockLogger = {
      trigger: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
      error: vi.fn()
    };

    vi.mocked(AgentLoggerModule.AgentLogger.getInstance).mockReturnValue(mockLogger as any);

    const mockExecuteTool = vi.fn().mockResolvedValue({
      success: true,
      result: 'done'
    });

    vi.mocked(MCPService.getMCPService).mockReturnValue({
      executeTool: mockExecuteTool
    } as any);

    await WorkflowExecutor.execute(rule);

    // Verify logging calls
    expect(mockLogger.trigger).toHaveBeenCalledWith(
      rule.id,
      'WORKFLOW_STARTED',
      expect.any(Object)
    );
    expect(mockLogger.success).toHaveBeenCalledWith(
      rule.id,
      expect.stringContaining('STEP_COMPLETED'),
      expect.any(Object)
    );
    expect(mockLogger.success).toHaveBeenCalledWith(
      rule.id,
      'WORKFLOW_COMPLETED',
      expect.any(Object)
    );
  });
});
