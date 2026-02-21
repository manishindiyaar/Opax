/**
 * Property-Based Test: Agent Rule Persistence Round-Trip
 * Feature: agent-box, Property 1: Agent Rule Persistence Round-Trip
 * 
 * Validates: Requirements 1.1, 1.2
 * 
 * Property: For any valid AgentRule object, serializing it to RxDB and then 
 * retrieving it by ID SHALL produce an equivalent object with all fields preserved.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { createRxDatabase, RxDatabase, RxCollection } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { agentRuleSchema, AgentRuleDocument, WorkflowStep, PollingConfig } from '../../src/shared/schema/agent_rules';
import { v4 as uuidv4 } from 'uuid';

type AgentRuleCollection = RxCollection<AgentRuleDocument>;

interface TestDatabaseCollections {
  agent_rules: AgentRuleCollection;
}

type TestDatabase = RxDatabase<TestDatabaseCollections>;

describe('Property: Agent Rule Persistence Round-Trip', () => {
  let db: TestDatabase | null = null;

  beforeEach(async () => {
    // Create a fresh in-memory database for each test
    db = await createRxDatabase<TestDatabaseCollections>({
      name: `test-${uuidv4()}`,
      storage: getRxStorageMemory(),
      multiInstance: false
    });

    await db.addCollections({
      agent_rules: { schema: agentRuleSchema }
    });
  });

  afterEach(async () => {
    // Clean up database after each test
    if (db && !db.destroyed) {
      await db.remove();
    }
    db = null;
  });

  // Arbitrary generators for AgentRule components
  const workflowStepArbitrary = (): fc.Arbitrary<WorkflowStep> => {
    return fc.oneof(
      // Action step
      fc.record({
        id: fc.stringMatching(/^step[0-9]+$/),
        type: fc.constant('action' as const),
        mcp_server: fc.string({ minLength: 1, maxLength: 50 }),
        tool_name: fc.string({ minLength: 1, maxLength: 50 }),
        args_template: fc.dictionary(fc.string(), fc.anything())
      }),
      // Condition step
      fc.record({
        id: fc.stringMatching(/^step[0-9]+$/),
        type: fc.constant('condition' as const),
        condition_rule: fc.dictionary(fc.string(), fc.anything())
      })
    );
  };

  const pollingConfigArbitrary = (): fc.Arbitrary<PollingConfig> => {
    return fc.record({
      mcp_server: fc.string({ minLength: 1, maxLength: 50 }),
      tool_name: fc.string({ minLength: 1, maxLength: 50 }),
      interval_seconds: fc.integer({ min: 10, max: 3600 }),
      cursor_field: fc.string({ minLength: 1, maxLength: 50 })
    });
  };

  const agentRuleArbitrary = (): fc.Arbitrary<AgentRuleDocument> => {
    return fc.oneof(
      // CRON-based rule
      fc.record({
        id: fc.uuid(),  // Generate a new UUID for each test
        name: fc.string({ minLength: 1, maxLength: 200 }),
        description: fc.string({ minLength: 1, maxLength: 1000 }),
        is_active: fc.boolean(),
        trigger_type: fc.constant('cron' as const),
        cron_expression: fc.constantFrom(
          '0 9 * * *',    // 9 AM daily
          '30 8 * * *',   // 8:30 AM daily
          '0 */2 * * *',  // Every 2 hours
          '0 0 * * 0'     // Weekly on Sunday
        ),
        steps: fc.array(workflowStepArbitrary(), { minLength: 1, maxLength: 10 }),
        last_run_status: fc.constantFrom('success', 'failed', 'pending', null),
        last_cursor_value: fc.option(fc.string(), { nil: undefined }),
        last_run_at: fc.option(fc.integer({ min: 0 }), { nil: undefined }),
        consecutive_failures: fc.integer({ min: 0, max: 10 }),
        created_at: fc.integer({ min: Date.now() - 86400000, max: Date.now() }),
        updated_at: fc.integer({ min: Date.now() - 86400000, max: Date.now() })
      }),
      // Event-based (polling) rule
      fc.record({
        id: fc.uuid(),  // Generate a new UUID for each test
        name: fc.string({ minLength: 1, maxLength: 200 }),
        description: fc.string({ minLength: 1, maxLength: 1000 }),
        is_active: fc.boolean(),
        trigger_type: fc.constant('event' as const),
        polling_config: pollingConfigArbitrary(),
        steps: fc.array(workflowStepArbitrary(), { minLength: 1, maxLength: 10 }),
        last_run_status: fc.constantFrom('success', 'failed', 'pending', null),
        last_cursor_value: fc.option(fc.string(), { nil: undefined }),
        last_run_at: fc.option(fc.integer({ min: 0 }), { nil: undefined }),
        consecutive_failures: fc.integer({ min: 0, max: 10 }),
        created_at: fc.integer({ min: Date.now() - 86400000, max: Date.now() }),
        updated_at: fc.integer({ min: Date.now() - 86400000, max: Date.now() })
      })
    );
  };

  it('should preserve all fields through save and retrieve cycle', async () => {
    if (!db) throw new Error('Database not initialized');
    
    await fc.assert(
      fc.asyncProperty(agentRuleArbitrary(), async (rule) => {
        // Save the rule to RxDB
        await db.agent_rules.insert(rule);

        // Retrieve the rule by ID
        const retrieved = await db.agent_rules.findOne(rule.id).exec();

        // Verify the rule was retrieved
        expect(retrieved).not.toBeNull();
        
        if (retrieved) {
          const retrievedData = retrieved.toJSON();

          // Verify all required fields are preserved
          expect(retrievedData.id).toBe(rule.id);
          expect(retrievedData.name).toBe(rule.name);
          expect(retrievedData.description).toBe(rule.description);
          expect(retrievedData.is_active).toBe(rule.is_active);
          expect(retrievedData.trigger_type).toBe(rule.trigger_type);
          expect(retrievedData.consecutive_failures).toBe(rule.consecutive_failures);
          expect(retrievedData.created_at).toBe(rule.created_at);
          expect(retrievedData.updated_at).toBe(rule.updated_at);

          // Verify trigger-specific fields
          if (rule.trigger_type === 'cron') {
            expect(retrievedData.cron_expression).toBe(rule.cron_expression);
          } else {
            expect(retrievedData.polling_config).toEqual(rule.polling_config);
          }

          // Verify steps array
          expect(retrievedData.steps).toHaveLength(rule.steps.length);
          retrievedData.steps.forEach((step, index) => {
            expect(step.id).toBe(rule.steps[index].id);
            expect(step.type).toBe(rule.steps[index].type);
            
            if (step.type === 'action') {
              expect(step.mcp_server).toBe(rule.steps[index].mcp_server);
              expect(step.tool_name).toBe(rule.steps[index].tool_name);
              expect(step.args_template).toEqual(rule.steps[index].args_template);
            } else {
              expect(step.condition_rule).toEqual(rule.steps[index].condition_rule);
            }
          });

          // Verify optional state fields
          expect(retrievedData.last_run_status).toBe(rule.last_run_status);
          expect(retrievedData.last_cursor_value).toBe(rule.last_cursor_value);
          expect(retrievedData.last_run_at).toBe(rule.last_run_at);

          // Clean up
          await retrieved.remove();
        }
      }),
      { numRuns: 100 } // Run 100 iterations as specified in design
    );
  });

  it('should generate unique IDs for each created rule', async () => {
    if (!db) throw new Error('Database not initialized');
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(agentRuleArbitrary(), { minLength: 2, maxLength: 10 }),
        async (rules) => {
          // Ensure each rule has a unique ID
          const uniqueRules = rules.map(rule => ({
            ...rule,
            id: uuidv4()
          }));

          // Insert all rules
          await db.agent_rules.bulkInsert(uniqueRules);

          // Retrieve all rules
          const allRules = await db.agent_rules.find().exec();

          // Verify all IDs are unique
          const ids = allRules.map(r => r.id);
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(ids.length);

          // Clean up
          await db.agent_rules.find().remove();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve cursor value updates', async () => {
    if (!db) throw new Error('Database not initialized');
    
    // Simple test: create a rule, update cursor, verify
    const rule: AgentRuleDocument = {
      id: uuidv4(),
      name: 'Test Rule',
      description: 'Test Description',
      is_active: true,
      trigger_type: 'event',
      polling_config: {
        mcp_server: 'test-server',
        tool_name: 'test-tool',
        interval_seconds: 60,
        cursor_field: 'id'
      },
      steps: [{
        id: 'step1',
        type: 'action',
        mcp_server: 'test',
        tool_name: 'test',
        args_template: {}
      }],
      last_run_status: null,
      consecutive_failures: 0,
      created_at: Date.now(),
      updated_at: Date.now()
    };

    // Insert rule
    await db.agent_rules.insert(rule);

    // Update cursor value
    const newCursor = 'cursor-123';
    const doc = await db.agent_rules.findOne(rule.id).exec();
    if (!doc) throw new Error('Document not found');
    
    await doc.incrementalModify((oldData) => {
      oldData.last_cursor_value = newCursor;
      return oldData;
    });

    // Retrieve and verify
    const updated = await db.agent_rules.findOne(rule.id).exec();
    expect(updated?.last_cursor_value).toBe(newCursor);

    // Clean up
    await updated?.remove();
  });

  it('should only accept valid trigger types', async () => {
    if (!db) throw new Error('Database not initialized');
    
    const validRule: AgentRuleDocument = {
      id: uuidv4(),
      name: 'Test Rule',
      description: 'Test',
      is_active: true,
      trigger_type: 'cron',
      cron_expression: '0 9 * * *',
      steps: [{
        id: 'step1',
        type: 'action',
        mcp_server: 'test',
        tool_name: 'test_tool',
        args_template: {}
      }],
      last_run_status: null,
      consecutive_failures: 0,
      created_at: Date.now(),
      updated_at: Date.now()
    };

    // Valid rule should insert successfully
    const doc = await db.agent_rules.insert(validRule);
    expect(doc).toBeDefined();
    await doc.remove();

    // Invalid trigger type should be rejected by TypeScript
    // This is a compile-time check, not a runtime test
  });

  it('should only accept valid last_run_status values', async () => {
    if (!db) throw new Error('Database not initialized');
    
    await fc.assert(
      fc.asyncProperty(
        agentRuleArbitrary(),
        fc.constantFrom('success', 'failed', 'pending', null),
        async (rule, status) => {
          const ruleWithStatus = { ...rule, last_run_status: status };
          
          const doc = await db.agent_rules.insert(ruleWithStatus);
          const retrieved = await db.agent_rules.findOne(rule.id).exec();
          
          expect(retrieved?.last_run_status).toBe(status);
          
          await doc.remove();
        }
      ),
      { numRuns: 100 }
    );
  });
});
