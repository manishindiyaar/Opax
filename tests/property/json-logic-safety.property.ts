/**
 * Property-Based Tests for JSON Logic Safety
 * Feature: agent-box
 * Property 5: JSON Logic Safety
 * 
 * Requirements: 4.4, 9.3
 * 
 * Validates that JSON Logic condition evaluation:
 * - Always returns a boolean result
 * - Never executes arbitrary code
 * - Handles malicious patterns safely
 * - Handles invalid rules gracefully
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { WorkflowExecutor, ExecutionContext, JsonLogicRule } from '../../src/main/services/WorkflowExecutor';

describe('Property 5: JSON Logic Safety', () => {
  it('should always return a boolean result for any valid JSON Logic rule', () => {
    fc.assert(
      fc.property(
        // Generate random JSON Logic rules
        fc.oneof(
          // Simple equality checks
          fc.record({
            '==': fc.tuple(fc.jsonValue(), fc.jsonValue())
          }),
          // Comparison operators
          fc.record({
            '>': fc.tuple(fc.integer(), fc.integer())
          }),
          // Logical operators
          fc.record({
            'and': fc.array(fc.boolean(), { minLength: 1, maxLength: 5 })
          }),
          // Variable references
          fc.record({
            'var': fc.string()
          })
        ),
        fc.dictionary(fc.string(), fc.jsonValue()),
        (rule, contextData) => {
          const context: ExecutionContext = contextData;
          const result = WorkflowExecutor.evaluateCondition(rule as JsonLogicRule, context);
          
          // Result must be a boolean
          expect(typeof result).toBe('boolean');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle malicious code injection attempts safely', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          // Attempt to inject eval
          { 'eval': 'console.log("hacked")' },
          // Attempt to inject function
          { 'function': 'return 1+1' },
          // Attempt to access global objects
          { 'var': 'process.exit' },
          { 'var': 'require' },
          { 'var': '__dirname' },
          // Attempt to use constructor
          { 'constructor': 'Object' },
          // Deeply nested malicious patterns
          { 'and': [{ 'eval': 'alert(1)' }, true] }
        ),
        fc.dictionary(fc.string(), fc.jsonValue()),
        (maliciousRule, contextData) => {
          const context: ExecutionContext = contextData;
          
          // Should not throw an error
          expect(() => {
            const result = WorkflowExecutor.evaluateCondition(maliciousRule as JsonLogicRule, context);
            // Result must be a boolean
            expect(typeof result).toBe('boolean');
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle invalid rule structures gracefully', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Null and undefined
          fc.constant(null),
          fc.constant(undefined),
          // Invalid types
          fc.string(),
          fc.integer(),
          fc.boolean(),
          // Empty objects
          fc.constant({}),
          // Circular references (simulated with deep nesting)
          fc.constant({ 'a': { 'b': { 'c': { 'd': { 'e': 'deep' } } } } })
        ),
        fc.dictionary(fc.string(), fc.jsonValue()),
        (invalidRule, contextData) => {
          const context: ExecutionContext = contextData;
          
          // Should not throw an error
          expect(() => {
            const result = WorkflowExecutor.evaluateCondition(invalidRule as unknown as JsonLogicRule, context);
            // Result must be a boolean
            expect(typeof result).toBe('boolean');
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly evaluate standard JSON Logic operators', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (a, b) => {
          const context: ExecutionContext = { a, b };
          
          // Test equality
          const eqRule: JsonLogicRule = { '==': [{ 'var': 'a' }, { 'var': 'b' }] };
          const eqResult = WorkflowExecutor.evaluateCondition(eqRule, context);
          expect(eqResult).toBe(a === b);
          
          // Test greater than
          const gtRule: JsonLogicRule = { '>': [{ 'var': 'a' }, { 'var': 'b' }] };
          const gtResult = WorkflowExecutor.evaluateCondition(gtRule, context);
          expect(gtResult).toBe(a > b);
          
          // Test less than
          const ltRule: JsonLogicRule = { '<': [{ 'var': 'a' }, { 'var': 'b' }] };
          const ltResult = WorkflowExecutor.evaluateCondition(ltRule, context);
          expect(ltResult).toBe(a < b);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle complex nested conditions correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (x, y, z) => {
          const context: ExecutionContext = { x, y, z };
          
          // Test: (x > y) AND (y > z)
          const andRule: JsonLogicRule = {
            'and': [
              { '>': [{ 'var': 'x' }, { 'var': 'y' }] },
              { '>': [{ 'var': 'y' }, { 'var': 'z' }] }
            ]
          };
          const andResult = WorkflowExecutor.evaluateCondition(andRule, context);
          expect(andResult).toBe(x > y && y > z);
          
          // Test: (x > y) OR (y > z)
          const orRule: JsonLogicRule = {
            'or': [
              { '>': [{ 'var': 'x' }, { 'var': 'y' }] },
              { '>': [{ 'var': 'y' }, { 'var': 'z' }] }
            ]
          };
          const orResult = WorkflowExecutor.evaluateCondition(orRule, context);
          expect(orResult).toBe(x > y || y > z);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle missing variables gracefully', () => {
    fc.assert(
      fc.property(
        // Generate valid variable names (alphanumeric, no special chars)
        fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 20 }).map(arr => arr.join('')),
        fc.oneof(fc.integer(), fc.string(), fc.boolean(), fc.constant(null)),
        (varName, value) => {
          // Create a rule that references a variable
          const rule: JsonLogicRule = { '==': [{ 'var': varName }, value] };
          
          // Context without the variable
          const emptyContext: ExecutionContext = {};
          
          // Should not throw an error
          expect(() => {
            const result = WorkflowExecutor.evaluateCondition(rule, emptyContext);
            expect(typeof result).toBe('boolean');
          }).not.toThrow();
          
          // Context with the variable - test that it works correctly
          const contextWithVar: ExecutionContext = { [varName]: value };
          const result = WorkflowExecutor.evaluateCondition(rule, contextWithVar);
          // For primitive values, comparing with itself should be true
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should coerce non-boolean results to boolean', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer(),
          fc.string(),
          fc.constant(null),
          fc.constant(undefined),
          fc.array(fc.anything()),
          fc.object()
        ),
        (value) => {
          // Create a rule that returns a non-boolean value
          const rule: JsonLogicRule = { 'var': 'value' };
          const context: ExecutionContext = { value };
          
          const result = WorkflowExecutor.evaluateCondition(rule, context);
          
          // Result must be a boolean
          expect(typeof result).toBe('boolean');
          // Result should match JavaScript's Boolean coercion
          expect(result).toBe(Boolean(value));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should never execute code or modify global state', () => {
    // Track if any side effects occur
    let sideEffectOccurred = false;
    const originalConsoleLog = console.log;
    
    // Mock console.log to detect side effects (except our own error logging)
    console.log = (...args: unknown[]) => {
      // Only flag if it's not our error logging
      if (!args[0]?.toString().includes('JSON Logic evaluation error')) {
        sideEffectOccurred = true;
      }
      originalConsoleLog(...args);
    };
    
    fc.assert(
      fc.property(
        fc.constantFrom(
          // Various attempts to execute code
          { 'eval': 'console.log("side effect")' },
          { 'function': 'console.log("side effect")' },
          { 'var': 'console.log' },
          { 'var': 'process' },
          { 'var': 'global' },
          { 'var': 'window' }
        ),
        (maliciousRule) => {
          const context: ExecutionContext = {};
          
          // Reset flag
          sideEffectOccurred = false;
          
          // Evaluate the rule
          WorkflowExecutor.evaluateCondition(maliciousRule as JsonLogicRule, context);
          
          // No side effects should have occurred
          expect(sideEffectOccurred).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
    
    // Restore console.log
    console.log = originalConsoleLog;
  });
});
