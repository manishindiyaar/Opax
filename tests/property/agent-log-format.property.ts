/**
 * Property-Based Test: Log Entry Format Consistency
 * Feature: agent-box, Property 7: Log Entry Format Consistency
 * 
 * Validates: Requirements 7.7
 * 
 * Property: For any log event with any level and payload, the generated LogEntry
 * SHALL contain all required fields (timestamp, level, source, event) in the correct
 * format, and the timestamp SHALL be a valid ISO 8601 string.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { AgentLogger, LogLevel, LogEntry } from '../../src/main/services/AgentLogger';

describe('Property: Log Entry Format Consistency', () => {
  let logger: AgentLogger;

  beforeEach(() => {
    logger = AgentLogger.getInstance();
    logger.clearLogs();
  });

  // Arbitrary generators
  const logLevelArbitrary = (): fc.Arbitrary<LogLevel> => {
    return fc.constantFrom('INFO', 'SUCCESS', 'ERROR', 'TRIGGER', 'DEBUG');
  };

  const sourceArbitrary = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'AGENT_ENGINE',
      'SCHEDULER',
      'EXECUTOR',
      'WORKFLOW',
      'POLLING',
      'CRON'
    );
  };

  const eventArbitrary = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
      'TRIGGER_POLL',
      'STEP_EXECUTED',
      'WORKFLOW_STARTED',
      'WORKFLOW_COMPLETED',
      'RULE_REGISTERED',
      'RULE_UNREGISTERED',
      'CURSOR_UPDATED',
      'FAILURE_DETECTED'
    );
  };

  const payloadArbitrary = (): fc.Arbitrary<unknown> => {
    return fc.oneof(
      fc.constant(undefined),
      fc.string(),
      fc.integer(),
      fc.boolean(),
      fc.record({
        tool: fc.string(),
        result_found: fc.boolean(),
        data_snapshot: fc.record({
          id: fc.integer(),
          val: fc.string()
        })
      }),
      fc.array(fc.string()),
      fc.dictionary(fc.string(), fc.anything())
    );
  };

  const agentIdArbitrary = (): fc.Arbitrary<string | undefined> => {
    return fc.option(fc.uuid(), { nil: undefined });
  };

  it('should generate log entries with all required fields in correct format', () => {
    fc.assert(
      fc.property(
        logLevelArbitrary(),
        sourceArbitrary(),
        eventArbitrary(),
        payloadArbitrary(),
        agentIdArbitrary(),
        (level, source, event, payload, agentId) => {
          // Clear logs before each iteration
          logger.clearLogs();

          // Generate log entry
          logger.log({
            level,
            source,
            event,
            payload,
            agent_id: agentId
          });

          // Retrieve the log entry
          const logs = logger.getRecentLogs();
          expect(logs).toHaveLength(1);

          const entry = logs[0];

          // Verify required fields exist
          expect(entry).toHaveProperty('timestamp');
          expect(entry).toHaveProperty('level');
          expect(entry).toHaveProperty('source');
          expect(entry).toHaveProperty('event');

          // Verify field types
          expect(typeof entry.timestamp).toBe('string');
          expect(typeof entry.level).toBe('string');
          expect(typeof entry.source).toBe('string');
          expect(typeof entry.event).toBe('string');

          // Verify field values
          expect(entry.level).toBe(level);
          expect(entry.source).toBe(source);
          expect(entry.event).toBe(event);
          expect(entry.payload).toEqual(payload);
          expect(entry.agent_id).toBe(agentId);

          // Verify timestamp is valid ISO 8601
          const timestampDate = new Date(entry.timestamp);
          expect(timestampDate.toISOString()).toBe(entry.timestamp);
          expect(isNaN(timestampDate.getTime())).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should generate valid ISO 8601 timestamps', () => {
    fc.assert(
      fc.property(
        logLevelArbitrary(),
        sourceArbitrary(),
        eventArbitrary(),
        (level, source, event) => {
          logger.clearLogs();

          logger.log({ level, source, event });

          const logs = logger.getRecentLogs();
          const entry = logs[0];

          // Verify ISO 8601 format
          const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
          expect(entry.timestamp).toMatch(iso8601Regex);

          // Verify timestamp is parseable
          const date = new Date(entry.timestamp);
          expect(date.toISOString()).toBe(entry.timestamp);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve payload structure regardless of complexity', () => {
    fc.assert(
      fc.property(
        payloadArbitrary(),
        (payload) => {
          logger.clearLogs();

          logger.info('TEST', 'PAYLOAD_TEST', payload);

          const logs = logger.getRecentLogs();
          const entry = logs[0];

          // Verify payload is preserved exactly
          expect(entry.payload).toEqual(payload);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle all log level convenience methods consistently', () => {
    fc.assert(
      fc.property(
        sourceArbitrary(),
        eventArbitrary(),
        payloadArbitrary(),
        agentIdArbitrary(),
        (source, event, payload, agentId) => {
          logger.clearLogs();

          // Test each convenience method
          const methods: Array<{ method: keyof AgentLogger; expectedLevel: LogLevel }> = [
            { method: 'info', expectedLevel: 'INFO' },
            { method: 'success', expectedLevel: 'SUCCESS' },
            { method: 'error', expectedLevel: 'ERROR' },
            { method: 'trigger', expectedLevel: 'TRIGGER' },
            { method: 'debug', expectedLevel: 'DEBUG' }
          ];

          methods.forEach(({ method, expectedLevel }) => {
            logger.clearLogs();

            // Call the convenience method
            (logger[method] as (s: string, e: string, p?: unknown, a?: string) => void)(
              source,
              event,
              payload,
              agentId
            );

            const logs = logger.getRecentLogs();
            expect(logs).toHaveLength(1);

            const entry = logs[0];
            expect(entry.level).toBe(expectedLevel);
            expect(entry.source).toBe(source);
            expect(entry.event).toBe(event);
            expect(entry.payload).toEqual(payload);
            expect(entry.agent_id).toBe(agentId);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain circular buffer at max 1000 entries', () => {
    logger.clearLogs();

    // Add 1100 log entries
    for (let i = 0; i < 1100; i++) {
      logger.info('TEST', `EVENT_${i}`, { index: i });
    }

    const logs = logger.getRecentLogs();

    // Should only have 1000 entries
    expect(logs).toHaveLength(1000);

    // Should have the most recent 1000 (100-1099)
    expect(logs[0].event).toBe('EVENT_100');
    expect(logs[999].event).toBe('EVENT_1099');
  });

  it('should filter logs by agent ID correctly', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 5, maxLength: 10 }),
        fc.uuid(),
        (agentIds, targetAgentId) => {
          logger.clearLogs();

          // Add logs for various agents
          agentIds.forEach((agentId, index) => {
            logger.info('TEST', `EVENT_${index}`, undefined, agentId);
          });

          // Add logs for target agent
          logger.info('TEST', 'TARGET_EVENT_1', undefined, targetAgentId);
          logger.info('TEST', 'TARGET_EVENT_2', undefined, targetAgentId);

          // Get logs for target agent
          const targetLogs = logger.getAgentLogs(targetAgentId);

          // Should only have logs for target agent
          expect(targetLogs.length).toBeGreaterThanOrEqual(2);
          targetLogs.forEach(log => {
            expect(log.agent_id).toBe(targetAgentId);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle undefined and null payloads gracefully', () => {
    logger.clearLogs();

    logger.info('TEST', 'UNDEFINED_PAYLOAD', undefined);
    logger.info('TEST', 'NULL_PAYLOAD', null);
    logger.info('TEST', 'NO_PAYLOAD');

    const logs = logger.getRecentLogs();
    expect(logs).toHaveLength(3);

    expect(logs[0].payload).toBeUndefined();
    expect(logs[1].payload).toBeNull();
    expect(logs[2].payload).toBeUndefined();
  });

  it('should generate monotonically increasing timestamps', () => {
    logger.clearLogs();

    // Generate multiple log entries rapidly
    for (let i = 0; i < 10; i++) {
      logger.info('TEST', `EVENT_${i}`);
    }

    const logs = logger.getRecentLogs();

    // Verify timestamps are in order (or equal if generated in same millisecond)
    for (let i = 1; i < logs.length; i++) {
      const prevTime = new Date(logs[i - 1].timestamp).getTime();
      const currTime = new Date(logs[i].timestamp).getTime();
      expect(currTime).toBeGreaterThanOrEqual(prevTime);
    }
  });
});
