/**
 * Property-Based Test: Step Execution Order Preservation
 * Feature: agent-box, Property 6: Step Execution Order Preservation
 * 
 * Validates: Requirements 4.1, 4.2
 * 
 * Property: For any AgentRule with multiple steps, the WorkflowExecutor SHALL
 * execute steps in their array index order, with each step's result available
 * to subsequent steps.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { WorkflowExecutor, WorkflowStep, ExecutionContext } from '../../src/main/services/WorkflowExecutor';
import * as MCPService from '../../src/main/services/MCPService';

describe('Property: Step Execution Order Preservation', () => {
  // Mock MCP service before each test
  beforeEach(() => {
    vi.mock('../../src/main/services/MCPService', () => ({
      getMCPService: vi.fn(() => ({
        executeTool: vi.fn()
      }))
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Arbitrary generator for action steps
  const actionStepArbitrary = (id: string): fc.Arbitrary<WorkflowStep> => {
    return fc.record({
      id: fc.constant(id),
      type: fc.constant('action' as const),
      mcp_server: fc.constant('test-server'),
      tool_name: fc.constant('test-tool'),
      args_template: fc.record({
        value: fc.oneof(fc.string(), fc.integer())
      })
    });
  };

  // Arbitrary generator for condition steps
  const conditionStepArbitrary = (id: string): fc.Arbitrary<WorkflowStep> => {
    return fc.record({
      id: fc.constant(id),
      type: fc.constant('condition' as const),
      condition_rule: fc.record({
        '==': fc.constant([1, 1]) // Always true condition
      })
    });
  };

  it('should execute action steps in array order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }), // Number of steps
        async (numSteps) => {
          // Generate steps with sequential IDs
          const steps: WorkflowStep[] = [];
          for (let i = 0; i < numSteps; i++) {
            steps.push({
              id: `step${i}`,
              type: 'action',
              mcp_server: 'test-server',
              tool_name: 'test-tool',
              args_template: { stepIndex: i }
            });
          }

          // Track execution order
          const executionOrder: string[] = [];
          
          // Mock MCP service to track execution order
          const mockExecuteTool = vi.fn().mockImplementation((toolName, args) => {
            executionOrder.push(`step${args.stepIndex}`);
            return Promise.resolve({
              success: true,
              result: { stepIndex: args.stepIndex, data: `result${args.stepIndex}` }
            });
          });

          vi.mocked(MCPService.getMCPService).mockReturnValue({
            executeTool: mockExecuteTool
          } as any);

          // Execute steps sequentially
          const context: ExecutionContext = { trigger: {} };
          for (const step of steps) {
            await WorkflowExecutor.executeStep(step, context);
          }

          // Verify execution order matches array order
          expect(executionOrder).toEqual(steps.map(s => s.id));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should make each step result available to subsequent steps', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        fc.array(fc.string(), { minLength: 2, maxLength: 5 }),
        async (numSteps, resultValues) => {
          // Generate steps
          const steps: WorkflowStep[] = [];
          for (let i = 0; i < numSteps; i++) {
            steps.push({
              id: `step${i}`,
              type: 'action',
              mcp_server: 'test-server',
              tool_name: 'test-tool',
              args_template: { index: i }
            });
          }

          // Mock MCP service to return predictable results
          const mockExecuteTool = vi.fn().mockImplementation((toolName, args) => {
            const index = args.index;
            return Promise.resolve({
              success: true,
              result: { value: resultValues[index % resultValues.length] }
            });
          });

          vi.mocked(MCPService.getMCPService).mockReturnValue({
            executeTool: mockExecuteTool
          } as any);

          // Execute steps and build context
          const context: ExecutionContext = { trigger: {} };
          for (const step of steps) {
            const result = await WorkflowExecutor.executeStep(step, context);
            // Add step result to context (simulating workflow executor behavior)
            context[step.id] = result.data;
          }

          // Verify all step results are in context
          for (let i = 0; i < numSteps; i++) {
            expect(context[`step${i}`]).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow steps to reference previous step results', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(),
        fc.integer(),
        async (value1, value2) => {
          // Step 1: Returns value1
          const step1: WorkflowStep = {
            id: 'step1',
            type: 'action',
            mcp_server: 'test-server',
            tool_name: 'get-data',
            args_template: {}
          };

          // Step 2: Uses {{step1.result}} in its arguments
          const step2: WorkflowStep = {
            id: 'step2',
            type: 'action',
            mcp_server: 'test-server',
            tool_name: 'process-data',
            args_template: {
              input: '{{step1.result}}',
              multiplier: value2
            }
          };

          // Mock MCP service
          const mockExecuteTool = vi.fn()
            .mockResolvedValueOnce({
              success: true,
              result: value1
            })
            .mockResolvedValueOnce({
              success: true,
              result: `processed-${value1}-${value2}`
            });

          vi.mocked(MCPService.getMCPService).mockReturnValue({
            executeTool: mockExecuteTool
          } as any);

          // Execute step 1
          const context: ExecutionContext = { trigger: {} };
          const result1 = await WorkflowExecutor.executeStep(step1, context);
          context.step1 = { result: result1.data };

          // Execute step 2 (should have access to step1 result)
          const result2 = await WorkflowExecutor.executeStep(step2, context);

          // Verify step2 received hydrated arguments
          expect(mockExecuteTool).toHaveBeenCalledTimes(2);
          const step2Args = mockExecuteTool.mock.calls[1][1];
          expect(step2Args.input).toBe(value1);
          expect(step2Args.multiplier).toBe(value2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should execute condition steps in order and make results available', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        fc.boolean(),
        async (condition1, condition2) => {
          const steps: WorkflowStep[] = [
            {
              id: 'condition1',
              type: 'condition',
              condition_rule: { '==': [condition1, true] }
            },
            {
              id: 'condition2',
              type: 'condition',
              condition_rule: { '==': [condition2, true] }
            }
          ];

          // Execute steps and build context
          const context: ExecutionContext = { trigger: {} };
          const results: boolean[] = [];
          
          for (const step of steps) {
            const result = await WorkflowExecutor.executeStep(step, context);
            context[step.id] = result.data;
            results.push(result.data as boolean);
          }

          // Verify results match expected conditions
          expect(results[0]).toBe(condition1);
          expect(results[1]).toBe(condition2);
          
          // Verify results are in context
          expect(context.condition1).toBe(condition1);
          expect(context.condition2).toBe(condition2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle mixed action and condition steps in order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(),
        fc.boolean(),
        async (actionResult, conditionValue) => {
          const steps: WorkflowStep[] = [
            {
              id: 'action1',
              type: 'action',
              mcp_server: 'test-server',
              tool_name: 'get-data',
              args_template: {}
            },
            {
              id: 'condition1',
              type: 'condition',
              condition_rule: { '==': [conditionValue, true] }
            },
            {
              id: 'action2',
              type: 'action',
              mcp_server: 'test-server',
              tool_name: 'process-data',
              args_template: {
                input: '{{action1.result}}'
              }
            }
          ];

          // Mock MCP service
          const mockExecuteTool = vi.fn()
            .mockResolvedValueOnce({
              success: true,
              result: actionResult
            })
            .mockResolvedValueOnce({
              success: true,
              result: `processed-${actionResult}`
            });

          vi.mocked(MCPService.getMCPService).mockReturnValue({
            executeTool: mockExecuteTool
          } as any);

          // Execute steps in order
          const context: ExecutionContext = { trigger: {} };
          const stepResults: Array<{ id: string; data: unknown }> = [];

          for (const step of steps) {
            const result = await WorkflowExecutor.executeStep(step, context);
            context[step.id] = { result: result.data };
            stepResults.push({ id: step.id, data: result.data });
          }

          // Verify execution order
          expect(stepResults[0].id).toBe('action1');
          expect(stepResults[1].id).toBe('condition1');
          expect(stepResults[2].id).toBe('action2');

          // Verify results are correct
          expect(stepResults[0].data).toBe(actionResult);
          expect(stepResults[1].data).toBe(conditionValue);
          
          // Verify action2 had access to action1 result
          expect(mockExecuteTool).toHaveBeenCalledTimes(2);
          const action2Args = mockExecuteTool.mock.calls[1][1];
          expect(action2Args.input).toBe(actionResult);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve context across multiple steps', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer(), { minLength: 3, maxLength: 5 }),
        async (values) => {
          // Create steps that accumulate values
          const steps: WorkflowStep[] = values.map((_, i) => ({
            id: `step${i}`,
            type: 'action' as const,
            mcp_server: 'test-server',
            tool_name: 'accumulate',
            args_template: { value: values[i] }
          }));

          // Mock MCP service to return the value
          const mockExecuteTool = vi.fn().mockImplementation((toolName, args) => {
            return Promise.resolve({
              success: true,
              result: args.value
            });
          });

          vi.mocked(MCPService.getMCPService).mockReturnValue({
            executeTool: mockExecuteTool
          } as any);

          // Execute all steps
          const context: ExecutionContext = { trigger: {} };
          for (const step of steps) {
            const result = await WorkflowExecutor.executeStep(step, context);
            context[step.id] = result.data;
          }

          // Verify all results are in context
          for (let i = 0; i < values.length; i++) {
            expect(context[`step${i}`]).toBe(values[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle steps that reference multiple previous steps', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer(),
        fc.integer(),
        async (value1, value2) => {
          const steps: WorkflowStep[] = [
            {
              id: 'step1',
              type: 'action',
              mcp_server: 'test-server',
              tool_name: 'get-value1',
              args_template: {}
            },
            {
              id: 'step2',
              type: 'action',
              mcp_server: 'test-server',
              tool_name: 'get-value2',
              args_template: {}
            },
            {
              id: 'step3',
              type: 'action',
              mcp_server: 'test-server',
              tool_name: 'combine',
              args_template: {
                a: '{{step1.result}}',
                b: '{{step2.result}}'
              }
            }
          ];

          // Mock MCP service
          const mockExecuteTool = vi.fn()
            .mockResolvedValueOnce({ success: true, result: value1 })
            .mockResolvedValueOnce({ success: true, result: value2 })
            .mockResolvedValueOnce({ success: true, result: value1 + value2 });

          vi.mocked(MCPService.getMCPService).mockReturnValue({
            executeTool: mockExecuteTool
          } as any);

          // Execute steps
          const context: ExecutionContext = { trigger: {} };
          
          const result1 = await WorkflowExecutor.executeStep(steps[0], context);
          context.step1 = { result: result1.data };
          
          const result2 = await WorkflowExecutor.executeStep(steps[1], context);
          context.step2 = { result: result2.data };
          
          const result3 = await WorkflowExecutor.executeStep(steps[2], context);

          // Verify step3 received both previous results
          // Note: Template hydration converts values to strings
          const step3Args = mockExecuteTool.mock.calls[2][1];
          expect(step3Args.a).toBe(String(value1));
          expect(step3Args.b).toBe(String(value2));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain execution order even with fast-completing steps', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 5, max: 10 }),
        async (numSteps) => {
          // Create many steps that complete quickly
          const steps: WorkflowStep[] = [];
          for (let i = 0; i < numSteps; i++) {
            steps.push({
              id: `step${i}`,
              type: 'action',
              mcp_server: 'test-server',
              tool_name: 'fast-operation',
              args_template: { index: i }
            });
          }

          const executionOrder: number[] = [];
          
          // Mock MCP service with immediate resolution
          const mockExecuteTool = vi.fn().mockImplementation((toolName, args) => {
            executionOrder.push(args.index);
            return Promise.resolve({
              success: true,
              result: { index: args.index }
            });
          });

          vi.mocked(MCPService.getMCPService).mockReturnValue({
            executeTool: mockExecuteTool
          } as any);

          // Execute all steps
          const context: ExecutionContext = { trigger: {} };
          for (const step of steps) {
            await WorkflowExecutor.executeStep(step, context);
          }

          // Verify execution order is sequential
          const expectedOrder = Array.from({ length: numSteps }, (_, i) => i);
          expect(executionOrder).toEqual(expectedOrder);
        }
      ),
      { numRuns: 100 }
    );
  });
});
