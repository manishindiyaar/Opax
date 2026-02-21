/**
 * Property-Based Tests: CRON Expression Validation
 * Feature: agent-box, Property 2: CRON Expression Validation
 * 
 * Validates: Requirements 2.2, 2.4
 * 
 * Property 2: CRON Expression Validation
 * For any string input as a CRON expression, the AgentScheduler SHALL either 
 * accept it as valid (and successfully schedule a job) or reject it with an 
 * error—never silently fail or schedule an invalid job.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { AgentScheduler, AgentRule } from '../../src/main/services/AgentScheduler';

describe('Property: CRON Expression Validation', () => {
  let scheduler: AgentScheduler;
  let testRuleIds: string[] = [];
  let idCounter = 0;

  beforeEach(async () => {
    scheduler = AgentScheduler.getInstance();
    await scheduler.initialize();
    testRuleIds = [];
    idCounter = 0;
  });

  afterEach(async () => {
    // Cleanup all test rules
    for (const ruleId of testRuleIds) {
      try {
        await scheduler.unregisterRule(ruleId);
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
    testRuleIds = [];
    await scheduler.shutdown();
  });

  const trackRule = (ruleId: string) => {
    testRuleIds.push(ruleId);
  };

  const generateUniqueId = () => {
    return `test-rule-${Date.now()}-${idCounter++}`;
  };

  /**
   * Generator for valid CRON expressions
   * CRON format: minute hour day month weekday
   * - minute: 0-59
   * - hour: 0-23
   * - day: 1-31
   * - month: 1-12
   * - weekday: 0-7 (0 and 7 are Sunday)
   */
  const validCronExpression = fc.oneof(
    // Standard time-based patterns
    fc.record({
      minute: fc.integer({ min: 0, max: 59 }),
      hour: fc.integer({ min: 0, max: 23 }),
      day: fc.oneof(fc.constant('*'), fc.integer({ min: 1, max: 31 })),
      month: fc.oneof(fc.constant('*'), fc.integer({ min: 1, max: 12 })),
      weekday: fc.oneof(fc.constant('*'), fc.integer({ min: 0, max: 7 }))
    }).map(({ minute, hour, day, month, weekday }) => 
      `${minute} ${hour} ${day} ${month} ${weekday}`
    ),
    
    // Wildcard patterns
    fc.constant('* * * * *'),
    fc.constant('0 * * * *'),
    fc.constant('0 0 * * *'),
    fc.constant('0 0 1 * *'),
    fc.constant('0 0 * * 0'),
    
    // Step values
    fc.constant('*/5 * * * *'),
    fc.constant('*/10 * * * *'),
    fc.constant('*/15 * * * *'),
    fc.constant('0 */2 * * *'),
    fc.constant('0 0 */2 * *'),
    
    // Range patterns
    fc.constant('0 9-17 * * *'),
    fc.constant('0 0 * * 1-5'),
    fc.constant('30 8 * * 1-5'),
    
    // List patterns
    fc.constant('0 9,12,15 * * *'),
    fc.constant('0 0 1,15 * *'),
    fc.constant('0 0 * * 1,3,5')
  );

  /**
   * Generator for invalid CRON expressions
   * Only includes expressions that node-cron actually rejects
   */
  const invalidCronExpression = fc.oneof(
    // Empty or whitespace
    fc.constant(''),
    fc.constant('   '),
    
    // Wrong number of fields (node-cron accepts 5 or 6 fields)
    fc.constant('* *'),
    fc.constant('* * *'),
    fc.constant('* * * *'),
    
    // Out of range values
    fc.constant('60 * * * *'),  // minute > 59
    fc.constant('* 24 * * *'),  // hour > 23
    fc.constant('* * 32 * *'),  // day > 31
    fc.constant('* * * 13 *'),  // month > 12
    fc.constant('-1 * * * *'),  // negative minute
    
    // Invalid characters
    fc.constant('a * * * *'),
    fc.constant('* b * * *'),
    fc.constant('* * c * *'),
    fc.constant('* * * d *'),
    fc.constant('* * * * e'),
    fc.constant('@ * * * *'),
    fc.constant('# * * * *'),
    
    // Invalid patterns
    fc.constant('*/0 * * * *'),  // step by 0
    
    // Random strings that don't match CRON pattern
    fc.string({ minLength: 1, maxLength: 20 }).filter(s => 
      !s.match(/^[\d\*\/\-,]+\s+[\d\*\/\-,]+\s+[\d\*\/\-,]+\s+[\d\*\/\-,]+\s+[\d\*\/\-,]+(\s+[\d\*\/\-,]+)?$/)
    ),
    
    // Special characters
    fc.constant('!@#$%'),
    fc.constant('hello world'),
    fc.constant('invalid cron')
  );

  it('should accept all valid CRON expressions', async () => {
    await fc.assert(
      fc.asyncProperty(validCronExpression, fc.uuid(), async (cronExpr, ruleId) => {
        trackRule(ruleId);
        
        const rule: AgentRule = {
          id: ruleId,
          name: 'Test Rule',
          trigger_type: 'cron',
          cron_expression: cronExpr,
          steps: [],
          is_active: true,
          consecutive_failures: 0
        };

        const initialCount = scheduler.getCronJobCount();

        // Should not throw for valid expressions
        await scheduler.registerRule(rule);
        
        // Should have scheduled exactly one more job
        expect(scheduler.getCronJobCount()).toBe(initialCount + 1);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject all invalid CRON expressions with error', async () => {
    // Test with known invalid expressions
    const knownInvalidExpressions = [
      '',
      '   ',
      '* *',
      '* * *',
      '* * * *',
      '60 * * * *',
      '* 24 * * *',
      '* * 32 * *',
      '* * * 13 *',
      '-1 * * * *',
      'a * * * *',
      '* b * * *',
      '@ * * * *',
      '# * * * *',
      '*/0 * * * *',
      '!@#$%',
      'hello world',
      'invalid cron'
    ];

    for (const cronExpr of knownInvalidExpressions) {
      const ruleId = generateUniqueId();
      const rule: AgentRule = {
        id: ruleId,
        name: 'Test Rule',
        trigger_type: 'cron',
        cron_expression: cronExpr,
        steps: [],
        is_active: true,
        consecutive_failures: 0
      };

      const initialCount = scheduler.getCronJobCount();

      // Should throw for invalid expressions
      try {
        await scheduler.registerRule(rule);
        // If we get here, the expression was accepted when it shouldn't have been
        throw new Error(`Expression "${cronExpr}" was accepted but should have been rejected`);
      } catch (error) {
        // Expected to throw - verify it's not our custom error
        if (error instanceof Error && error.message.includes('was accepted but should have been rejected')) {
          throw error;
        }
      }
      
      // Should not have scheduled any new job
      expect(scheduler.getCronJobCount()).toBe(initialCount);
    }
  });

  it('should never silently fail - always either accept or reject with error', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(validCronExpression, invalidCronExpression),
        fc.uuid(),
        async (cronExpr, ruleId) => {
          const rule: AgentRule = {
            id: ruleId,
            name: 'Test Rule',
            trigger_type: 'cron',
            cron_expression: cronExpr,
            steps: [],
            is_active: true,
            consecutive_failures: 0
          };

          const initialCount = scheduler.getCronJobCount();
          let didThrow = false;
          let jobScheduled = false;

          try {
            await scheduler.registerRule(rule);
            trackRule(ruleId);
            jobScheduled = scheduler.getCronJobCount() > initialCount;
          } catch (error) {
            didThrow = true;
          }

          // Either it threw an error OR it scheduled a job, never both, never neither
          expect(didThrow !== jobScheduled).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should provide descriptive error messages for invalid expressions', async () => {
    // Test with known invalid expressions
    const knownInvalidExpressions = [
      '',
      '   ',
      '* *',
      '* * *',
      '* * * *',
      '60 * * * *',
      '* 24 * * *',
      '* * 32 * *',
      '* * * 13 *',
      '-1 * * * *',
      'a * * * *',
      '* b * * *',
      '@ * * * *',
      '# * * * *',
      '*/0 * * * *',
      '!@#$%',
      'hello world',
      'invalid cron'
    ];

    for (const cronExpr of knownInvalidExpressions) {
      const ruleId = generateUniqueId();
      const rule: AgentRule = {
        id: ruleId,
        name: 'Test Rule',
        trigger_type: 'cron',
        cron_expression: cronExpr,
        steps: [],
        is_active: true,
        consecutive_failures: 0
      };

      let errorThrown = false;
      let errorMessage = '';

      try {
        await scheduler.registerRule(rule);
      } catch (error) {
        errorThrown = true;
        errorMessage = (error as Error).message;
      }

      // Should have thrown an error
      expect(errorThrown).toBe(true);
      
      // Error message should be descriptive
      expect(errorMessage.length).toBeGreaterThan(0);
      expect(errorMessage.toLowerCase()).toMatch(/invalid|cron|expression/);
    }
  });

  it('should handle edge case: missing cron_expression field', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (ruleId) => {
        const rule: AgentRule = {
          id: ruleId,
          name: 'Test Rule',
          trigger_type: 'cron',
          // No cron_expression field
          steps: [],
          is_active: true,
          consecutive_failures: 0
        };

        // Should throw error
        await expect(scheduler.registerRule(rule)).rejects.toThrow(/no cron_expression/i);
        
        // Should not have scheduled any job
        expect(scheduler.getCronJobCount()).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('should validate before scheduling - no partial state on error', async () => {
    await fc.assert(
      fc.asyncProperty(invalidCronExpression, fc.uuid(), async (cronExpr, ruleId) => {
        const rule: AgentRule = {
          id: ruleId,
          name: 'Test Rule',
          trigger_type: 'cron',
          cron_expression: cronExpr,
          steps: [],
          is_active: true,
          consecutive_failures: 0
        };

        const initialCount = scheduler.getCronJobCount();

        try {
          await scheduler.registerRule(rule);
        } catch (error) {
          // On error, job count should remain unchanged
          expect(scheduler.getCronJobCount()).toBe(initialCount);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should handle concurrent validation requests correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(validCronExpression, { minLength: 2, maxLength: 5 }),
        async (cronExpressions) => {
          const initialCount = scheduler.getCronJobCount();
          
          // Generate unique IDs for each expression
          const rulesData = cronExpressions.map((expr) => {
            const ruleId = generateUniqueId();
            trackRule(ruleId);
            return [expr, ruleId] as [string, string];
          });
          
          // Register multiple rules concurrently
          const promises = rulesData.map(([cronExpr, ruleId]) => {
            const rule: AgentRule = {
              id: ruleId,
              name: 'Test Rule',
              trigger_type: 'cron',
              cron_expression: cronExpr,
              steps: [],
              is_active: true,
              consecutive_failures: 0
            };
            return scheduler.registerRule(rule);
          });

          await Promise.all(promises);

          // All jobs should be scheduled
          expect(scheduler.getCronJobCount()).toBe(initialCount + rulesData.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain consistency: re-validation of same expression yields same result', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(validCronExpression, invalidCronExpression),
        fc.uuid(),
        async (cronExpr, ruleId1) => {
          const ruleId2 = `${ruleId1}-second`;
          
          const rule1: AgentRule = {
            id: ruleId1,
            name: 'Test Rule',
            trigger_type: 'cron',
            cron_expression: cronExpr,
            steps: [],
            is_active: true,
            consecutive_failures: 0
          };

          let firstResult: 'success' | 'error' = 'success';
          try {
            await scheduler.registerRule(rule1);
            trackRule(ruleId1);
          } catch (error) {
            firstResult = 'error';
          }

          // Try again with same expression but different ID
          const rule2: AgentRule = {
            id: ruleId2,
            name: 'Test Rule',
            trigger_type: 'cron',
            cron_expression: cronExpr,
            steps: [],
            is_active: true,
            consecutive_failures: 0
          };

          let secondResult: 'success' | 'error' = 'success';
          try {
            await scheduler.registerRule(rule2);
            trackRule(ruleId2);
          } catch (error) {
            secondResult = 'error';
          }

          // Results should be consistent
          expect(firstResult).toBe(secondResult);
        }
      ),
      { numRuns: 100 }
    );
  });
});
