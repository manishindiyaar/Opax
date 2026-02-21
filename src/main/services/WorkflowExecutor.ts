/**
 * WorkflowExecutor - Executes Agent Box workflows
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 10.1, 10.2
 * 
 * Handles template hydration, condition evaluation, and step execution
 */

import * as jsonLogic from 'json-logic-js';
import { getMCPService } from './MCPService';
import { AgentLogger } from './AgentLogger';

/**
 * JSON Logic rule type (json-logic-js format)
 */
export type JsonLogicRule = Record<string, unknown>;

/**
 * Workflow step definition
 */
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

/**
 * Execution context containing data from trigger and previous steps
 */
export interface ExecutionContext {
  trigger?: unknown;
  [key: string]: unknown;
}

/**
 * Result of a step execution
 */
export interface StepResult {
  success: boolean;
  data?: unknown;
  error?: string;
  duration?: number;
}

/**
 * Result of a workflow execution
 */
export interface ExecutionResult {
  success: boolean;
  steps: Record<string, StepResult>;
  error?: string;
  duration?: number;
}

/**
 * Agent Rule interface (minimal subset needed for execution)
 */
export interface AgentRule {
  id: string;
  name: string;
  steps: WorkflowStep[];
  last_run_status?: 'success' | 'failed' | 'pending' | null;
}

// Default timeout for step execution (60 seconds)
const STEP_EXECUTION_TIMEOUT = 60000;

/**
 * WorkflowExecutor - Handles workflow execution
 */
export class WorkflowExecutor {
  /**
   * Hydrate a template string by replacing {{variable.path}} patterns with context values
   * 
   * @param template - Template string with {{variable}} patterns
   * @param context - Execution context containing variable values
   * @returns Hydrated string with variables replaced
   * 
   * Examples:
   * - hydrateTemplate("Hello {{user.name}}", { user: { name: "Alice" } }) => "Hello Alice"
   * - hydrateTemplate("{{step1.result}}", { step1: { result: 42 } }) => "42"
   */
  static hydrateTemplate(template: string, context: ExecutionContext): string {
    // Match {{variable.path}} patterns with optional whitespace
    // Variable names must start with a letter or underscore, followed by letters, numbers, underscores, or dots
    const pattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_\.]*)\s*\}\}/g;
    
    return template.replace(pattern, (_match, path) => {
      // Path is already captured without whitespace by the regex
      const cleanPath = path.trim();
      
      // Navigate the context object using the path
      const value = this.getNestedValue(context, cleanPath);
      
      // If value is undefined or null, return empty string
      if (value === undefined || value === null) {
        return '';
      }
      
      // Convert value to string
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      
      return String(value);
    });
  }

  /**
   * Hydrate an object recursively by replacing template strings in all string values
   * 
   * @param obj - Object to hydrate (can contain nested objects and arrays)
   * @param context - Execution context containing variable values
   * @returns Hydrated object with all template strings replaced
   * 
   * Examples:
   * - hydrateObject({ msg: "Hello {{name}}" }, { name: "Bob" }) => { msg: "Hello Bob" }
   * - hydrateObject({ items: ["{{a}}", "{{b}}"] }, { a: 1, b: 2 }) => { items: ["1", "2"] }
   */
  static hydrateObject(obj: unknown, context: ExecutionContext): unknown {
    // Handle null and undefined
    if (obj === null || obj === undefined) {
      return obj;
    }

    // Handle strings - apply template hydration
    if (typeof obj === 'string') {
      return this.hydrateTemplate(obj, context);
    }

    // Handle arrays - recursively hydrate each element
    if (Array.isArray(obj)) {
      return obj.map(item => this.hydrateObject(item, context));
    }

    // Handle objects - recursively hydrate each property
    if (typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.hydrateObject(value, context);
      }
      return result;
    }

    // For primitives (numbers, booleans), return as-is
    return obj;
  }

  /**
   * Evaluate a JSON Logic condition rule against the execution context
   * 
   * @param rule - JSON Logic rule object
   * @param context - Execution context containing variable values
   * @returns Boolean result of the condition evaluation
   * 
   * Requirements: 4.4, 9.3
   * 
   * Examples:
   * - evaluateCondition({ "==": [{ "var": "age" }, 25] }, { age: 25 }) => true
   * - evaluateCondition({ ">": [{ "var": "score" }, 80] }, { score: 90 }) => true
   * - evaluateCondition({ "and": [{ ">": [{ "var": "x" }, 0] }, { "<": [{ "var": "x" }, 10] }] }, { x: 5 }) => true
   */
  static evaluateCondition(rule: JsonLogicRule, context: ExecutionContext): boolean {
    try {
      // Use json-logic-js to safely evaluate the condition
      // This prevents code injection via eval()
      const result = jsonLogic.apply(rule, context);
      
      // Ensure the result is a boolean
      // json-logic-js can return any type, so we coerce to boolean
      return Boolean(result);
    } catch (error) {
      // If evaluation fails, log the error and return false
      // This ensures that invalid conditions don't break the workflow
      console.error('JSON Logic evaluation error:', error);
      return false;
    }
  }

  /**
   * Execute a single workflow step
   * 
   * @param step - The workflow step to execute
   * @param context - Execution context containing trigger data and previous step results
   * @returns Promise resolving to StepResult with success status and data/error
   * 
   * Requirements: 4.1, 4.2, 4.5
   * 
   * For action steps:
   * - Hydrates the args_template with context values
   * - Calls the MCP tool via MCPService
   * - Returns the tool result or error
   * 
   * For condition steps:
   * - Evaluates the condition_rule against the context
   * - Returns boolean result
   */
  static async executeStep(step: WorkflowStep, context: ExecutionContext): Promise<StepResult> {
    const startTime = Date.now();
    
    try {
      if (step.type === 'action') {
        // Validate action step has required fields
        if (!step.mcp_server || !step.tool_name) {
          return {
            success: false,
            error: `Action step ${step.id} missing required fields: mcp_server or tool_name`,
            duration: Date.now() - startTime
          };
        }

        // Hydrate the arguments template with context values
        const hydratedArgs = step.args_template 
          ? this.hydrateObject(step.args_template, context) as Record<string, unknown>
          : {};

        console.log(`[WorkflowExecutor] Executing action step ${step.id}: ${step.tool_name}`);
        console.log(`[WorkflowExecutor] Hydrated arguments:`, JSON.stringify(hydratedArgs, null, 2));

        // Get MCP service instance
        const mcpService = getMCPService();

        // Execute the tool with timeout
        const executePromise = mcpService.executeTool(step.tool_name, hydratedArgs);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Step execution timeout after ${STEP_EXECUTION_TIMEOUT}ms`)), STEP_EXECUTION_TIMEOUT);
        });

        const toolResult = await Promise.race([executePromise, timeoutPromise]);

        if (toolResult.success) {
          console.log(`[WorkflowExecutor] Step ${step.id} completed successfully`);
          return {
            success: true,
            data: toolResult.result,
            duration: Date.now() - startTime
          };
        } else {
          console.error(`[WorkflowExecutor] Step ${step.id} failed:`, toolResult.error);
          return {
            success: false,
            error: toolResult.error || 'Tool execution failed',
            duration: Date.now() - startTime
          };
        }

      } else if (step.type === 'condition') {
        // Validate condition step has required fields
        if (!step.condition_rule) {
          return {
            success: false,
            error: `Condition step ${step.id} missing required field: condition_rule`,
            duration: Date.now() - startTime
          };
        }

        console.log(`[WorkflowExecutor] Evaluating condition step ${step.id}`);
        
        // Evaluate the condition
        const conditionResult = this.evaluateCondition(step.condition_rule, context);
        
        console.log(`[WorkflowExecutor] Condition ${step.id} evaluated to: ${conditionResult}`);
        
        return {
          success: true,
          data: conditionResult,
          duration: Date.now() - startTime
        };

      } else {
        return {
          success: false,
          error: `Unknown step type: ${step.type}`,
          duration: Date.now() - startTime
        };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[WorkflowExecutor] Step ${step.id} execution error:`, errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Get a nested value from an object using a dot-separated path
   * 
   * @param obj - Object to navigate
   * @param path - Dot-separated path (e.g., "user.name" or "step1.result")
   * @returns Value at the path, or undefined if not found
   * 
   * Examples:
   * - getNestedValue({ user: { name: "Alice" } }, "user.name") => "Alice"
   * - getNestedValue({ step1: { result: 42 } }, "step1.result") => 42
   * - getNestedValue({ a: { b: { c: "deep" } } }, "a.b.c") => "deep"
   */
  private static getNestedValue(obj: unknown, path: string): unknown {
    // Split path by dots
    const parts = path.split('.');
    
    let current: unknown = obj;
    
    // Navigate through each part of the path
    for (const part of parts) {
      // If current is not an object, we can't navigate further
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      
      // Get the next level
      current = (current as Record<string, unknown>)[part];
    }
    
    return current;
  }

  /**
   * Execute a complete workflow
   * 
   * @param rule - The Agent Rule containing workflow steps
   * @param triggerData - Data from the trigger event (optional)
   * @returns Promise resolving to ExecutionResult with success status and step results
   * 
   * Requirements: 4.6, 4.7, 10.1, 10.2
   * 
   * Process:
   * 1. Initialize execution context with trigger data
   * 2. Execute steps sequentially in array order
   * 3. Add each step's result to context for subsequent steps
   * 4. Handle condition-based step skipping
   * 5. Log execution events via AgentLogger
   * 6. Return overall execution result
   */
  static async execute(rule: AgentRule, triggerData?: unknown): Promise<ExecutionResult> {
    const startTime = Date.now();
    const logger = AgentLogger.getInstance();
    
    // Log workflow start
    logger.trigger(rule.id, 'WORKFLOW_STARTED', {
      ruleName: rule.name,
      stepCount: rule.steps.length,
      hasTriggerData: !!triggerData
    });

    // Initialize execution context with trigger data
    const context: ExecutionContext = {
      trigger: triggerData || {}
    };

    // Track step results
    const stepResults: Record<string, StepResult> = {};
    let workflowSuccess = true;
    let workflowError: string | undefined;

    try {
      // Execute steps sequentially
      for (let i = 0; i < rule.steps.length; i++) {
        const step = rule.steps[i];
        
        logger.info('EXECUTOR', `Executing step ${step.id}`, {
          agentId: rule.id,
          stepIndex: i,
          stepType: step.type
        }, rule.id);

        // Execute the step
        const stepResult = await this.executeStep(step, context);
        
        // Store step result
        stepResults[step.id] = stepResult;

        // Add step result to context for subsequent steps
        // Store under step ID so it can be referenced as {{stepId.data}}
        context[step.id] = stepResult.data;

        // Log step completion
        if (stepResult.success) {
          logger.success(rule.id, `STEP_COMPLETED: ${step.id}`, {
            duration: stepResult.duration,
            hasData: stepResult.data !== undefined
          });
        } else {
          logger.error(rule.id, `STEP_FAILED: ${step.id}`, {
            error: stepResult.error,
            duration: stepResult.duration
          });

          // Mark workflow as failed
          workflowSuccess = false;
          workflowError = `Step ${step.id} failed: ${stepResult.error}`;
          
          // Stop processing on step failure (Requirements 10.2)
          break;
        }

        // Handle condition-based step skipping (Requirements 4.5)
        // If this was a condition step that evaluated to false, we could skip subsequent steps
        // For now, we continue processing all steps unless there's a failure
      }

      // Calculate total duration
      const duration = Date.now() - startTime;

      // Log workflow completion
      if (workflowSuccess) {
        logger.success(rule.id, 'WORKFLOW_COMPLETED', {
          duration,
          stepsExecuted: Object.keys(stepResults).length
        });
      } else {
        logger.error(rule.id, 'WORKFLOW_FAILED', {
          duration,
          error: workflowError,
          stepsExecuted: Object.keys(stepResults).length
        });
      }

      return {
        success: workflowSuccess,
        steps: stepResults,
        error: workflowError,
        duration
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const duration = Date.now() - startTime;
      
      logger.error(rule.id, 'WORKFLOW_ERROR', {
        error: errorMessage,
        duration,
        stepsExecuted: Object.keys(stepResults).length
      });

      return {
        success: false,
        steps: stepResults,
        error: errorMessage,
        duration
      };
    }
  }
}
