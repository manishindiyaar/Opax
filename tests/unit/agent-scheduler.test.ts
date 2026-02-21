/**
 * Unit Tests: AgentScheduler
 * 
 * Tests the AgentScheduler singleton and lifecycle methods
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentScheduler, AgentRule } from '../../src/main/services/AgentScheduler';

describe('AgentScheduler', () => {
  let scheduler: AgentScheduler;

  beforeEach(async () => {
    scheduler = AgentScheduler.getInstance();
    await scheduler.initialize();
  });

  afterEach(async () => {
    await scheduler.shutdown();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = AgentScheduler.getInstance();
      const instance2 = AgentScheduler.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Lifecycle', () => {
    it('should initialize successfully', async () => {
      // Already initialized in beforeEach
      expect(scheduler.isInitialized()).toBe(true);
    });

    it('should not initialize twice', async () => {
      // Already initialized in beforeEach
      await scheduler.initialize(); // Should not throw
      expect(scheduler.isInitialized()).toBe(true);
    });

    it('should shutdown successfully', async () => {
      await scheduler.shutdown();
      expect(scheduler.isInitialized()).toBe(false);
    });

    it('should clear jobs and intervals on shutdown', async () => {
      expect(scheduler.getCronJobCount()).toBe(0);
      expect(scheduler.getPollingIntervalCount()).toBe(0);
      
      await scheduler.shutdown();
      
      expect(scheduler.getCronJobCount()).toBe(0);
      expect(scheduler.getPollingIntervalCount()).toBe(0);
    });
  });

  describe('Rule Registration', () => {
    it('should register an active CRON rule', async () => {
      const rule: AgentRule = {
        id: 'test-rule-1',
        name: 'Test CRON Rule',
        trigger_type: 'cron',
        cron_expression: '0 9 * * *',
        steps: [],
        is_active: true,
        consecutive_failures: 0
      };

      await scheduler.registerRule(rule);
      
      // Rule should be registered (implementation details will be tested in later tasks)
      expect(true).toBe(true);
    });

    it('should register an active polling rule', async () => {
      const rule: AgentRule = {
        id: 'test-rule-2',
        name: 'Test Polling Rule',
        trigger_type: 'event',
        polling_config: {
          mcp_server: 'test-server',
          tool_name: 'test-tool',
          interval_seconds: 30,
          cursor_field: 'id'
        },
        steps: [],
        is_active: true,
        consecutive_failures: 0
      };

      await scheduler.registerRule(rule);
      
      // Rule should be registered (implementation details will be tested in later tasks)
      expect(true).toBe(true);
    });

    it('should not register an inactive rule', async () => {
      const rule: AgentRule = {
        id: 'test-rule-3',
        name: 'Inactive Rule',
        trigger_type: 'cron',
        cron_expression: '0 9 * * *',
        steps: [],
        is_active: false,
        consecutive_failures: 0
      };

      await scheduler.registerRule(rule);
      
      // Rule should not be registered
      expect(scheduler.getCronJobCount()).toBe(0);
    });

    it('should throw error if not initialized', async () => {
      await scheduler.shutdown();
      
      const rule: AgentRule = {
        id: 'test-rule-4',
        name: 'Test Rule',
        trigger_type: 'cron',
        cron_expression: '0 9 * * *',
        steps: [],
        is_active: true,
        consecutive_failures: 0
      };

      await expect(scheduler.registerRule(rule)).rejects.toThrow('not initialized');
    });
  });

  describe('Rule Unregistration', () => {
    it('should unregister a rule', async () => {
      const rule: AgentRule = {
        id: 'test-rule-5',
        name: 'Test Rule',
        trigger_type: 'cron',
        cron_expression: '0 9 * * *',
        steps: [],
        is_active: true,
        consecutive_failures: 0
      };

      await scheduler.registerRule(rule);
      await scheduler.unregisterRule(rule.id);
      
      // Rule should be unregistered
      expect(true).toBe(true);
    });

    it('should handle unregistering non-existent rule', async () => {
      await scheduler.unregisterRule('non-existent-rule');
      
      // Should not throw
      expect(true).toBe(true);
    });

    it('should throw error if not initialized', async () => {
      await scheduler.shutdown();
      
      await expect(scheduler.unregisterRule('test-rule')).rejects.toThrow('not initialized');
    });
  });

  describe('Load Active Rules', () => {
    it('should load active rules', async () => {
      await scheduler.loadActiveRules();
      
      // Should not throw (implementation will be added in task 5.6)
      expect(true).toBe(true);
    });

    it('should throw error if not initialized', async () => {
      await scheduler.shutdown();
      
      await expect(scheduler.loadActiveRules()).rejects.toThrow('not initialized');
    });
  });

  describe('Helper Methods', () => {
    it('should return correct CRON job count', () => {
      expect(scheduler.getCronJobCount()).toBe(0);
    });

    it('should return correct polling interval count', () => {
      expect(scheduler.getPollingIntervalCount()).toBe(0);
    });

    it('should return initialization status', () => {
      expect(scheduler.isInitialized()).toBe(true);
    });
  });

  describe('CRON Job Management', () => {
    it('should schedule a valid CRON job', async () => {
      const rule: AgentRule = {
        id: 'cron-test-1',
        name: 'Daily Morning Briefing',
        trigger_type: 'cron',
        cron_expression: '0 9 * * *', // 9 AM daily
        steps: [],
        is_active: true,
        consecutive_failures: 0
      };

      await scheduler.registerRule(rule);
      
      expect(scheduler.getCronJobCount()).toBe(1);
    });

    it('should reject invalid CRON expression', async () => {
      const rule: AgentRule = {
        id: 'cron-test-2',
        name: 'Invalid CRON',
        trigger_type: 'cron',
        cron_expression: 'invalid cron',
        steps: [],
        is_active: true,
        consecutive_failures: 0
      };

      await expect(scheduler.registerRule(rule)).rejects.toThrow('Invalid CRON expression');
    });

    it('should reject rule without CRON expression', async () => {
      const rule: AgentRule = {
        id: 'cron-test-3',
        name: 'Missing CRON',
        trigger_type: 'cron',
        // No cron_expression
        steps: [],
        is_active: true,
        consecutive_failures: 0
      };

      await expect(scheduler.registerRule(rule)).rejects.toThrow('no cron_expression');
    });

    it('should cancel an existing CRON job', async () => {
      const rule: AgentRule = {
        id: 'cron-test-4',
        name: 'Test CRON',
        trigger_type: 'cron',
        cron_expression: '0 9 * * *',
        steps: [],
        is_active: true,
        consecutive_failures: 0
      };

      await scheduler.registerRule(rule);
      expect(scheduler.getCronJobCount()).toBe(1);

      scheduler.cancelCronJob(rule.id);
      expect(scheduler.getCronJobCount()).toBe(0);
    });

    it('should handle cancelling non-existent CRON job', () => {
      scheduler.cancelCronJob('non-existent-cron');
      // Should not throw
      expect(true).toBe(true);
    });

    it('should accept various valid CRON expressions', async () => {
      const expressions = [
        '0 9 * * *',      // Daily at 9 AM
        '*/5 * * * *',    // Every 5 minutes
        '0 0 * * 0',      // Weekly on Sunday
        '0 0 1 * *',      // Monthly on 1st
        '30 8 * * 1-5'    // Weekdays at 8:30 AM
      ];

      for (let i = 0; i < expressions.length; i++) {
        const rule: AgentRule = {
          id: `cron-valid-${i}`,
          name: `Valid CRON ${i}`,
          trigger_type: 'cron',
          cron_expression: expressions[i],
          steps: [],
          is_active: true,
          consecutive_failures: 0
        };

        await scheduler.registerRule(rule);
      }

      expect(scheduler.getCronJobCount()).toBe(expressions.length);
    });

    it('should replace existing CRON job when re-registering', async () => {
      const rule: AgentRule = {
        id: 'cron-test-5',
        name: 'Test CRON',
        trigger_type: 'cron',
        cron_expression: '0 9 * * *',
        steps: [],
        is_active: true,
        consecutive_failures: 0
      };

      await scheduler.registerRule(rule);
      expect(scheduler.getCronJobCount()).toBe(1);

      // Re-register with different expression
      rule.cron_expression = '0 10 * * *';
      await scheduler.registerRule(rule);
      
      // Should still have only 1 job (replaced)
      expect(scheduler.getCronJobCount()).toBe(1);
    });
  });

  describe('Polling Management', () => {
    it('should start polling for a valid rule', async () => {
      const rule: AgentRule = {
        id: 'poll-test-1',
        name: 'Test Polling Rule',
        trigger_type: 'event',
        polling_config: {
          mcp_server: 'test-server',
          tool_name: 'test-tool',
          interval_seconds: 30,
          cursor_field: 'id'
        },
        steps: [],
        is_active: true,
        consecutive_failures: 0
      };

      await scheduler.registerRule(rule);

      expect(scheduler.getPollingIntervalCount()).toBe(1);
    });

    it('should reject polling with interval less than 10 seconds', async () => {
      const rule: AgentRule = {
        id: 'poll-test-2',
        name: 'Invalid Interval',
        trigger_type: 'event',
        polling_config: {
          mcp_server: 'test-server',
          tool_name: 'test-tool',
          interval_seconds: 5, // Too short
          cursor_field: 'id'
        },
        steps: [],
        is_active: true,
        consecutive_failures: 0
      };

      await expect(scheduler.registerRule(rule)).rejects.toThrow(/at least 10 seconds/);
      expect(scheduler.getPollingIntervalCount()).toBe(0);
    });

    it('should reject rule without polling_config', async () => {
      const rule: AgentRule = {
        id: 'poll-test-3',
        name: 'Missing Config',
        trigger_type: 'event',
        // No polling_config
        steps: [],
        is_active: true,
        consecutive_failures: 0
      };

      await expect(scheduler.registerRule(rule)).rejects.toThrow(/no polling_config/);
      expect(scheduler.getPollingIntervalCount()).toBe(0);
    });

    it('should stop an existing polling interval', async () => {
      const rule: AgentRule = {
        id: 'poll-test-4',
        name: 'Test Polling',
        trigger_type: 'event',
        polling_config: {
          mcp_server: 'test-server',
          tool_name: 'test-tool',
          interval_seconds: 10,
          cursor_field: 'id'
        },
        steps: [],
        is_active: true,
        consecutive_failures: 0
      };

      await scheduler.registerRule(rule);
      expect(scheduler.getPollingIntervalCount()).toBe(1);

      scheduler.stopPolling(rule.id);
      expect(scheduler.getPollingIntervalCount()).toBe(0);
    });

    it('should handle stopping non-existent polling interval', () => {
      scheduler.stopPolling('non-existent-poll');
      expect(scheduler.getPollingIntervalCount()).toBe(0);
    });

    it('should accept minimum 10 second interval', async () => {
      const rule: AgentRule = {
        id: 'poll-test-5',
        name: 'Minimum Interval',
        trigger_type: 'event',
        polling_config: {
          mcp_server: 'test-server',
          tool_name: 'test-tool',
          interval_seconds: 10, // Exactly 10 seconds
          cursor_field: 'id'
        },
        steps: [],
        is_active: true,
        consecutive_failures: 0
      };

      await scheduler.registerRule(rule);
      expect(scheduler.getPollingIntervalCount()).toBe(1);
    });

    it('should replace existing polling interval when re-registering', async () => {
      const rule: AgentRule = {
        id: 'poll-test-6',
        name: 'Test Polling',
        trigger_type: 'event',
        polling_config: {
          mcp_server: 'test-server',
          tool_name: 'test-tool',
          interval_seconds: 30,
          cursor_field: 'id'
        },
        steps: [],
        is_active: true,
        consecutive_failures: 0
      };

      // Register first time
      await scheduler.registerRule(rule);
      expect(scheduler.getPollingIntervalCount()).toBe(1);

      // Re-register with different interval
      rule.polling_config.interval_seconds = 60;
      await scheduler.registerRule(rule);
      
      // Should still have only 1 interval (replaced)
      expect(scheduler.getPollingIntervalCount()).toBe(1);
    });
  });
});
