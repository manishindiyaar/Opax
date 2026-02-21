/**
 * Property-Based Test: Variable Hydration Completeness
 * Feature: agent-box, Property 4: Variable Hydration Completeness
 * 
 * Validates: Requirements 4.3, 4.8
 * 
 * Property: For any template with {{variable}} patterns and matching context,
 * all valid variable references SHALL be resolved to their corresponding values.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { WorkflowExecutor, ExecutionContext } from '../../src/main/services/WorkflowExecutor';

describe('Property: Variable Hydration Completeness', () => {
  // Arbitrary generators
  const simpleValueArbitrary = (): fc.Arbitrary<string | number | boolean> => {
    return fc.oneof(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.integer(),
      fc.boolean()
    );
  };

  const nestedObjectArbitrary = (): fc.Arbitrary<Record<string, unknown>> => {
    return fc.record({
      name: fc.string(),
      value: fc.oneof(fc.string(), fc.integer(), fc.boolean()),
      nested: fc.record({
        deep: fc.string(),
        count: fc.integer()
      })
    });
  };

  it('should replace all valid variable references in templates', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]*$/), // Valid variable name
        simpleValueArbitrary(),
        (varName, value) => {
          const template = `Value is {{${varName}}}`;
          const context: ExecutionContext = { [varName]: value };

          const result = WorkflowExecutor.hydrateTemplate(template, context);

          // Result should contain the string representation of the value
          const expectedValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
          expect(result).toBe(`Value is ${expectedValue}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle nested variable paths correctly', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (value1, value2) => {
          const template = '{{user.name}} works at {{user.company}}';
          const context: ExecutionContext = {
            user: {
              name: value1,
              company: value2
            }
          };

          const result = WorkflowExecutor.hydrateTemplate(template, context);

          expect(result).toBe(`${value1} works at ${value2}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle multiple variables in the same template', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer(),
        fc.boolean(),
        (str, num, bool) => {
          const template = 'String: {{a}}, Number: {{b}}, Boolean: {{c}}';
          const context: ExecutionContext = { a: str, b: num, c: bool };

          const result = WorkflowExecutor.hydrateTemplate(template, context);

          expect(result).toBe(`String: ${str}, Number: ${num}, Boolean: ${bool}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return empty string for undefined variables', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]*$/), // Valid variable name
        (varName) => {
          const template = `Value is {{${varName}}}`;
          const context: ExecutionContext = {}; // Empty context

          const result = WorkflowExecutor.hydrateTemplate(template, context);

          expect(result).toBe('Value is ');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle deeply nested paths', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (value) => {
          const template = '{{a.b.c.d.e}}';
          const context: ExecutionContext = {
            a: {
              b: {
                c: {
                  d: {
                    e: value
                  }
                }
              }
            }
          };

          const result = WorkflowExecutor.hydrateTemplate(template, context);

          expect(result).toBe(value);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should stringify objects when used in templates', () => {
    fc.assert(
      fc.property(
        nestedObjectArbitrary(),
        (obj) => {
          const template = 'Object: {{data}}';
          const context: ExecutionContext = { data: obj };

          const result = WorkflowExecutor.hydrateTemplate(template, context);

          expect(result).toBe(`Object: ${JSON.stringify(obj)}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle whitespace in variable names', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (value) => {
          const template = '{{ user.name }}';
          const context: ExecutionContext = { user: { name: value } };

          const result = WorkflowExecutor.hydrateTemplate(template, context);

          expect(result).toBe(value);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should hydrate objects recursively', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer(),
        (name, count) => {
          const obj = {
            message: 'Hello {{name}}',
            details: {
              count: '{{count}}',
              nested: ['{{name}}', '{{count}}']
            }
          };
          const context: ExecutionContext = { name, count };

          const result = WorkflowExecutor.hydrateObject(obj, context);

          expect(result).toEqual({
            message: `Hello ${name}`,
            details: {
              count: String(count),
              nested: [name, String(count)]
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve non-string values in objects', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.boolean(),
        (num, bool) => {
          const obj = {
            number: num,
            boolean: bool,
            template: '{{value}}'
          };
          const context: ExecutionContext = { value: 'test' };

          const result = WorkflowExecutor.hydrateObject(obj, context);

          expect(result).toEqual({
            number: num,
            boolean: bool,
            template: 'test'
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle arrays in objects', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 1, maxLength: 5 }),
        (values) => {
          const obj = {
            items: values.map((_, i) => `{{item${i}}}`)
          };
          const context: ExecutionContext = {};
          values.forEach((val, i) => {
            context[`item${i}`] = val;
          });

          const result = WorkflowExecutor.hydrateObject(obj, context) as { items: string[] };

          expect(result.items).toEqual(values);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle null and undefined in objects', () => {
    const obj = {
      nullValue: null,
      undefinedValue: undefined,
      template: '{{value}}'
    };
    const context: ExecutionContext = { value: 'test' };

    const result = WorkflowExecutor.hydrateObject(obj, context);

    expect(result).toEqual({
      nullValue: null,
      undefinedValue: undefined,
      template: 'test'
    });
  });

  it('should handle empty templates', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (template) => {
          // Template with no variables
          const context: ExecutionContext = { value: 'test' };

          const result = WorkflowExecutor.hydrateTemplate(template, context);

          // Should return the template unchanged
          expect(result).toBe(template);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle templates with only variables', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (value) => {
          const template = '{{value}}';
          const context: ExecutionContext = { value };

          const result = WorkflowExecutor.hydrateTemplate(template, context);

          expect(result).toBe(value);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle consecutive variables', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        (val1, val2) => {
          const template = '{{a}}{{b}}';
          const context: ExecutionContext = { a: val1, b: val2 };

          const result = WorkflowExecutor.hydrateTemplate(template, context);

          expect(result).toBe(`${val1}${val2}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle special characters in values', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (value) => {
          const template = 'Value: {{data}}';
          const context: ExecutionContext = { data: value };

          const result = WorkflowExecutor.hydrateTemplate(template, context);

          expect(result).toBe(`Value: ${value}`);
        }
      ),
      { numRuns: 100 }
    );
  });
});
