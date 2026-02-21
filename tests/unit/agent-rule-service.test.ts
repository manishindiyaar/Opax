/**
 * Unit Tests: AgentRuleService CRUD Operations
 * Feature: agent-box, Task 1.3
 * 
 * Validates: Requirements 1.2, 1.3, 1.5
 * 
 * Tests all CRUD operations and specialized methods of AgentRuleService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRxDatabase, RxDatabase, RxCollection } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { agentRuleSchema, AgentRuleDocument } from '../../src/shared/schema/agent_rules';
import { AgentRuleService } from '../../src/renderer/services/AgentRuleService';
import { v4 as uuidv4 } from 'uuid';

type AgentRuleCollection = RxCollection<AgentRuleDocument>;

interface TestDatabaseCollections {
  agent_rules: AgentRuleCollection;
}

type TestDatabase = RxDatabase<TestDatabaseCollections>;

// Mock the database module
let mockDb: TestDatabase | null = null;

vi.mock('../../src/renderer/db/database', () => ({
  getDatabase: async () => {
    if (!mockDb) {
      throw new Error('Mock database not initialized');
    }
    return mockDb;
  }
}));

describe('AgentRuleService', () => {
  beforeEach(async () => {
    // Create a fresh in-memory database for each test
    mockDb = await createRxDatabase<TestDatabaseCollections>({
      name: `test-${uuidv4()}`,
      storage: getRxStorageMemory(),
      multiInstance: false
    });

    await mockDb.addCollections({
      agent_rules: { schema: agentRuleSchema }
    });
  });

  afterEach(async () => {
    // Clean up database after each test
    if (mockDb && !mockDb.destroyed) {
      await mockDb.remove();
    }
    mockDb = null;
  });

  describe('create()', () => {
    it('should create a new agent rule with auto-generated ID and timestamps', async () => {
      const ruleData = {
        name: 'Morning Briefing',
        description: 'Send daily appointment summary',
        is_active: true,
        trigger_type: 'cron' as const,
        cron_expression: '30 8 * * *',
        steps: [{
          id: 'step1',
          type: 'action' as const,
          mcp_server: 'pms_mcp',
          tool_name: 'get_appointments',
          args_template: { date: 'today' }
        }],
        last_run_status: null,
        consecutive_failures: 0
      };

      const created = await AgentRuleService.create(ruleData);

      expect(created.id).toBeDefined();
      expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(created.name).toBe(ruleData.name);
      expect(created.description).toBe(ruleData.description);
      expect(created.created_at).toBeDefined();
      expect(created.updated_at).toBeDefined();
      expect(created.created_at).toBe(created.updated_at);
    });

    it('should create event-based rule with polling config', async () => {
      const ruleData = {
        name: 'Critical Lab Watchdog',
        description: 'Monitor for critical lab results',
        is_active: true,
        trigger_type: 'event' as const,
        polling_config: {
          mcp_server: 'lab_mcp',
          tool_name: 'get_recent_results',
          interval_seconds: 60,
          cursor_field: 'id'
        },
        steps: [{
          id: 'step1',
          type: 'condition' as const,
          condition_rule: { '==': [{ var: 'status' }, 'CRITICAL'] }
        }],
        last_run_status: null,
        consecutive_failures: 0
      };

      const created = await AgentRuleService.create(ruleData);

      expect(created.trigger_type).toBe('event');
      expect(created.polling_config).toEqual(ruleData.polling_config);
    });
  });

  describe('getById()', () => {
    it('should retrieve a rule by ID', async () => {
      const ruleData = {
        name: 'Test Rule',
        description: 'Test',
        is_active: true,
        trigger_type: 'cron' as const,
        cron_expression: '0 9 * * *',
        steps: [{
          id: 'step1',
          type: 'action' as const,
          mcp_server: 'test',
          tool_name: 'test_tool',
          args_template: {}
        }],
        last_run_status: null,
        consecutive_failures: 0
      };

      const created = await AgentRuleService.create(ruleData);
      const retrieved = await AgentRuleService.getById(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe(ruleData.name);
    });

    it('should return null for non-existent ID', async () => {
      const retrieved = await AgentRuleService.getById('non-existent-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('getAll()', () => {
    it('should return empty array when no rules exist', async () => {
      const rules = await AgentRuleService.getAll();
      expect(rules).toEqual([]);
    });

    it('should return all rules', async () => {
      const rule1 = await AgentRuleService.create({
        name: 'Rule 1',
        description: 'First rule',
        is_active: true,
        trigger_type: 'cron' as const,
        cron_expression: '0 9 * * *',
        steps: [{ id: 'step1', type: 'action' as const, mcp_server: 'test', tool_name: 'test', args_template: {} }],
        last_run_status: null,
        consecutive_failures: 0
      });

      const rule2 = await AgentRuleService.create({
        name: 'Rule 2',
        description: 'Second rule',
        is_active: false,
        trigger_type: 'event' as const,
        polling_config: {
          mcp_server: 'test',
          tool_name: 'test',
          interval_seconds: 60,
          cursor_field: 'id'
        },
        steps: [{ id: 'step1', type: 'action' as const, mcp_server: 'test', tool_name: 'test', args_template: {} }],
        last_run_status: null,
        consecutive_failures: 0
      });

      const rules = await AgentRuleService.getAll();
      expect(rules).toHaveLength(2);
      expect(rules.map(r => r.id)).toContain(rule1.id);
      expect(rules.map(r => r.id)).toContain(rule2.id);
    });
  });

  describe('getActiveRules()', () => {
    it('should return only active rules', async () => {
      await AgentRuleService.create({
        name: 'Active Rule',
        description: 'Active',
        is_active: true,
        trigger_type: 'cron' as const,
        cron_expression: '0 9 * * *',
        steps: [{ id: 'step1', type: 'action' as const, mcp_server: 'test', tool_name: 'test', args_template: {} }],
        last_run_status: null,
        consecutive_failures: 0
      });

      await AgentRuleService.create({
        name: 'Inactive Rule',
        description: 'Inactive',
        is_active: false,
        trigger_type: 'cron' as const,
        cron_expression: '0 10 * * *',
        steps: [{ id: 'step1', type: 'action' as const, mcp_server: 'test', tool_name: 'test', args_template: {} }],
        last_run_status: null,
        consecutive_failures: 0
      });

      const activeRules = await AgentRuleService.getActiveRules();
      expect(activeRules).toHaveLength(1);
      expect(activeRules[0].name).toBe('Active Rule');
      expect(activeRules[0].is_active).toBe(true);
    });
  });

  describe('update()', () => {
    it('should update rule fields and update timestamp', async () => {
      const created = await AgentRuleService.create({
        name: 'Original Name',
        description: 'Original Description',
        is_active: true,
        trigger_type: 'cron' as const,
        cron_expression: '0 9 * * *',
        steps: [{ id: 'step1', type: 'action' as const, mcp_server: 'test', tool_name: 'test', args_template: {} }],
        last_run_status: null,
        consecutive_failures: 0
      });

      const originalUpdatedAt = created.updated_at;

      // Wait a bit to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await AgentRuleService.update(created.id, {
        name: 'Updated Name',
        description: 'Updated Description'
      });

      expect(updated).not.toBeNull();
      expect(updated?.name).toBe('Updated Name');
      expect(updated?.description).toBe('Updated Description');
      expect(updated?.updated_at).toBeGreaterThan(originalUpdatedAt);
      expect(updated?.created_at).toBe(created.created_at);
    });

    it('should return null for non-existent rule', async () => {
      const updated = await AgentRuleService.update('non-existent-id', { name: 'New Name' });
      expect(updated).toBeNull();
    });
  });

  describe('updateCursor()', () => {
    it('should update cursor value for polling rules', async () => {
      const created = await AgentRuleService.create({
        name: 'Polling Rule',
        description: 'Test polling',
        is_active: true,
        trigger_type: 'event' as const,
        polling_config: {
          mcp_server: 'lab_mcp',
          tool_name: 'get_results',
          interval_seconds: 60,
          cursor_field: 'id'
        },
        steps: [{ id: 'step1', type: 'action' as const, mcp_server: 'test', tool_name: 'test', args_template: {} }],
        last_run_status: null,
        consecutive_failures: 0
      });

      await AgentRuleService.updateCursor(created.id, 'cursor-123');

      const retrieved = await AgentRuleService.getById(created.id);
      expect(retrieved?.last_cursor_value).toBe('cursor-123');
    });

    it('should throw error for non-existent rule', async () => {
      await expect(
        AgentRuleService.updateCursor('non-existent-id', 'cursor-123')
      ).rejects.toThrow('Agent rule non-existent-id not found');
    });
  });

  describe('updateStatus()', () => {
    it('should update status to success and reset failure count', async () => {
      const created = await AgentRuleService.create({
        name: 'Test Rule',
        description: 'Test',
        is_active: true,
        trigger_type: 'cron' as const,
        cron_expression: '0 9 * * *',
        steps: [{ id: 'step1', type: 'action' as const, mcp_server: 'test', tool_name: 'test', args_template: {} }],
        last_run_status: null,
        consecutive_failures: 3
      });

      await AgentRuleService.updateStatus(created.id, 'success');

      const retrieved = await AgentRuleService.getById(created.id);
      expect(retrieved?.last_run_status).toBe('success');
      expect(retrieved?.consecutive_failures).toBe(0);
      expect(retrieved?.last_run_at).toBeDefined();
    });

    it('should increment failure count when status is failed', async () => {
      const created = await AgentRuleService.create({
        name: 'Test Rule',
        description: 'Test',
        is_active: true,
        trigger_type: 'cron' as const,
        cron_expression: '0 9 * * *',
        steps: [{ id: 'step1', type: 'action' as const, mcp_server: 'test', tool_name: 'test', args_template: {} }],
        last_run_status: null,
        consecutive_failures: 0
      });

      await AgentRuleService.updateStatus(created.id, 'failed', true);

      const retrieved = await AgentRuleService.getById(created.id);
      expect(retrieved?.last_run_status).toBe('failed');
      expect(retrieved?.consecutive_failures).toBe(1);
    });

    it('should not increment failure count when incrementFailures is false', async () => {
      const created = await AgentRuleService.create({
        name: 'Test Rule',
        description: 'Test',
        is_active: true,
        trigger_type: 'cron' as const,
        cron_expression: '0 9 * * *',
        steps: [{ id: 'step1', type: 'action' as const, mcp_server: 'test', tool_name: 'test', args_template: {} }],
        last_run_status: null,
        consecutive_failures: 0
      });

      await AgentRuleService.updateStatus(created.id, 'failed', false);

      const retrieved = await AgentRuleService.getById(created.id);
      expect(retrieved?.last_run_status).toBe('failed');
      expect(retrieved?.consecutive_failures).toBe(0);
    });

    it('should throw error for non-existent rule', async () => {
      await expect(
        AgentRuleService.updateStatus('non-existent-id', 'success')
      ).rejects.toThrow('Agent rule non-existent-id not found');
    });
  });

  describe('toggleActive()', () => {
    it('should toggle is_active from true to false', async () => {
      const created = await AgentRuleService.create({
        name: 'Test Rule',
        description: 'Test',
        is_active: true,
        trigger_type: 'cron' as const,
        cron_expression: '0 9 * * *',
        steps: [{ id: 'step1', type: 'action' as const, mcp_server: 'test', tool_name: 'test', args_template: {} }],
        last_run_status: null,
        consecutive_failures: 0
      });

      const toggled = await AgentRuleService.toggleActive(created.id);
      expect(toggled?.is_active).toBe(false);
    });

    it('should toggle is_active from false to true', async () => {
      const created = await AgentRuleService.create({
        name: 'Test Rule',
        description: 'Test',
        is_active: false,
        trigger_type: 'cron' as const,
        cron_expression: '0 9 * * *',
        steps: [{ id: 'step1', type: 'action' as const, mcp_server: 'test', tool_name: 'test', args_template: {} }],
        last_run_status: null,
        consecutive_failures: 0
      });

      const toggled = await AgentRuleService.toggleActive(created.id);
      expect(toggled?.is_active).toBe(true);
    });

    it('should return null for non-existent rule', async () => {
      const toggled = await AgentRuleService.toggleActive('non-existent-id');
      expect(toggled).toBeNull();
    });
  });

  describe('delete()', () => {
    it('should delete an existing rule', async () => {
      const created = await AgentRuleService.create({
        name: 'Test Rule',
        description: 'Test',
        is_active: true,
        trigger_type: 'cron' as const,
        cron_expression: '0 9 * * *',
        steps: [{ id: 'step1', type: 'action' as const, mcp_server: 'test', tool_name: 'test', args_template: {} }],
        last_run_status: null,
        consecutive_failures: 0
      });

      const deleted = await AgentRuleService.delete(created.id);
      expect(deleted).toBe(true);

      const retrieved = await AgentRuleService.getById(created.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent rule', async () => {
      const deleted = await AgentRuleService.delete('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('getByTriggerType()', () => {
    it('should return only CRON rules', async () => {
      await AgentRuleService.create({
        name: 'CRON Rule',
        description: 'Test',
        is_active: true,
        trigger_type: 'cron' as const,
        cron_expression: '0 9 * * *',
        steps: [{ id: 'step1', type: 'action' as const, mcp_server: 'test', tool_name: 'test', args_template: {} }],
        last_run_status: null,
        consecutive_failures: 0
      });

      await AgentRuleService.create({
        name: 'Event Rule',
        description: 'Test',
        is_active: true,
        trigger_type: 'event' as const,
        polling_config: {
          mcp_server: 'test',
          tool_name: 'test',
          interval_seconds: 60,
          cursor_field: 'id'
        },
        steps: [{ id: 'step1', type: 'action' as const, mcp_server: 'test', tool_name: 'test', args_template: {} }],
        last_run_status: null,
        consecutive_failures: 0
      });

      const cronRules = await AgentRuleService.getByTriggerType('cron');
      expect(cronRules).toHaveLength(1);
      expect(cronRules[0].trigger_type).toBe('cron');
    });

    it('should return only event rules', async () => {
      await AgentRuleService.create({
        name: 'CRON Rule',
        description: 'Test',
        is_active: true,
        trigger_type: 'cron' as const,
        cron_expression: '0 9 * * *',
        steps: [{ id: 'step1', type: 'action' as const, mcp_server: 'test', tool_name: 'test', args_template: {} }],
        last_run_status: null,
        consecutive_failures: 0
      });

      await AgentRuleService.create({
        name: 'Event Rule',
        description: 'Test',
        is_active: true,
        trigger_type: 'event' as const,
        polling_config: {
          mcp_server: 'test',
          tool_name: 'test',
          interval_seconds: 60,
          cursor_field: 'id'
        },
        steps: [{ id: 'step1', type: 'action' as const, mcp_server: 'test', tool_name: 'test', args_template: {} }],
        last_run_status: null,
        consecutive_failures: 0
      });

      const eventRules = await AgentRuleService.getByTriggerType('event');
      expect(eventRules).toHaveLength(1);
      expect(eventRules[0].trigger_type).toBe('event');
    });
  });

  describe('getActiveByTriggerType()', () => {
    it('should return only active CRON rules', async () => {
      await AgentRuleService.create({
        name: 'Active CRON',
        description: 'Test',
        is_active: true,
        trigger_type: 'cron' as const,
        cron_expression: '0 9 * * *',
        steps: [{ id: 'step1', type: 'action' as const, mcp_server: 'test', tool_name: 'test', args_template: {} }],
        last_run_status: null,
        consecutive_failures: 0
      });

      await AgentRuleService.create({
        name: 'Inactive CRON',
        description: 'Test',
        is_active: false,
        trigger_type: 'cron' as const,
        cron_expression: '0 10 * * *',
        steps: [{ id: 'step1', type: 'action' as const, mcp_server: 'test', tool_name: 'test', args_template: {} }],
        last_run_status: null,
        consecutive_failures: 0
      });

      await AgentRuleService.create({
        name: 'Active Event',
        description: 'Test',
        is_active: true,
        trigger_type: 'event' as const,
        polling_config: {
          mcp_server: 'test',
          tool_name: 'test',
          interval_seconds: 60,
          cursor_field: 'id'
        },
        steps: [{ id: 'step1', type: 'action' as const, mcp_server: 'test', tool_name: 'test', args_template: {} }],
        last_run_status: null,
        consecutive_failures: 0
      });

      const activeCronRules = await AgentRuleService.getActiveByTriggerType('cron');
      expect(activeCronRules).toHaveLength(1);
      expect(activeCronRules[0].name).toBe('Active CRON');
      expect(activeCronRules[0].is_active).toBe(true);
      expect(activeCronRules[0].trigger_type).toBe('cron');
    });
  });
});
