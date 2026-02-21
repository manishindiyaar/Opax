/**
 * AgentRuleService - CRUD operations for Agent Rules
 * Requirements: 1.2, 1.3, 1.5
 */

import { getDatabase } from '../db/database';
import { AgentRuleDocument } from '../../shared/schema/agent_rules';
import { v4 as uuidv4 } from 'uuid';

export class AgentRuleService {
  /**
   * Create a new agent rule
   */
  static async create(rule: Omit<AgentRuleDocument, 'id' | 'created_at' | 'updated_at'>): Promise<AgentRuleDocument> {
    const db = await getDatabase();
    
    const now = Date.now();
    const newRule: AgentRuleDocument = {
      ...rule,
      id: uuidv4(),
      created_at: now,
      updated_at: now
    };

    await db.agent_rules.insert(newRule);
    return newRule;
  }

  /**
   * Get a rule by ID
   */
  static async getById(id: string): Promise<AgentRuleDocument | null> {
    const db = await getDatabase();
    const doc = await db.agent_rules.findOne(id).exec();
    return doc ? doc.toJSON() : null;
  }

  /**
   * Get all rules
   */
  static async getAll(): Promise<AgentRuleDocument[]> {
    const db = await getDatabase();
    const docs = await db.agent_rules.find().exec();
    return docs.map(doc => doc.toJSON());
  }

  /**
   * Get all active rules (where is_active === true)
   */
  static async getActiveRules(): Promise<AgentRuleDocument[]> {
    const db = await getDatabase();
    const docs = await db.agent_rules
      .find({
        selector: {
          is_active: true
        }
      })
      .exec();
    return docs.map(doc => doc.toJSON());
  }

  /**
   * Update an existing rule
   */
  static async update(id: string, updates: Partial<Omit<AgentRuleDocument, 'id' | 'created_at'>>): Promise<AgentRuleDocument | null> {
    const db = await getDatabase();
    const doc = await db.agent_rules.findOne(id).exec();
    
    if (!doc) {
      return null;
    }

    await doc.incrementalModify((oldData) => {
      Object.assign(oldData, updates);
      oldData.updated_at = Date.now();
      return oldData;
    });

    // Get fresh document after update
    const updated = await db.agent_rules.findOne(id).exec();
    return updated ? updated.toJSON() : null;
  }

  /**
   * Update cursor value for polling-based rules
   */
  static async updateCursor(ruleId: string, cursorValue: string): Promise<void> {
    const db = await getDatabase();
    const doc = await db.agent_rules.findOne(ruleId).exec();
    
    if (!doc) {
      throw new Error(`Agent rule ${ruleId} not found`);
    }

    await doc.incrementalModify((oldData) => {
      oldData.last_cursor_value = cursorValue;
      oldData.updated_at = Date.now();
      return oldData;
    });
  }

  /**
   * Update rule status after execution
   */
  static async updateStatus(
    ruleId: string, 
    status: 'success' | 'failed' | 'pending',
    incrementFailures: boolean = false
  ): Promise<void> {
    const db = await getDatabase();
    const doc = await db.agent_rules.findOne(ruleId).exec();
    
    if (!doc) {
      throw new Error(`Agent rule ${ruleId} not found`);
    }

    await doc.incrementalModify((oldData) => {
      oldData.last_run_status = status;
      oldData.last_run_at = Date.now();
      
      if (status === 'success') {
        oldData.consecutive_failures = 0;
      } else if (status === 'failed' && incrementFailures) {
        oldData.consecutive_failures = (oldData.consecutive_failures || 0) + 1;
      }
      
      oldData.updated_at = Date.now();
      return oldData;
    });
  }

  /**
   * Toggle rule active status
   */
  static async toggleActive(id: string): Promise<AgentRuleDocument | null> {
    const db = await getDatabase();
    const doc = await db.agent_rules.findOne(id).exec();
    
    if (!doc) {
      return null;
    }

    await doc.incrementalModify((oldData) => {
      oldData.is_active = !oldData.is_active;
      oldData.updated_at = Date.now();
      return oldData;
    });

    const updated = await db.agent_rules.findOne(id).exec();
    return updated ? updated.toJSON() : null;
  }

  /**
   * Delete a rule
   */
  static async delete(id: string): Promise<boolean> {
    const db = await getDatabase();
    const doc = await db.agent_rules.findOne(id).exec();
    
    if (!doc) {
      return false;
    }

    await doc.remove();
    return true;
  }

  /**
   * Get rules by trigger type
   */
  static async getByTriggerType(triggerType: 'cron' | 'event'): Promise<AgentRuleDocument[]> {
    const db = await getDatabase();
    const docs = await db.agent_rules
      .find({
        selector: {
          trigger_type: triggerType
        }
      })
      .exec();
    return docs.map(doc => doc.toJSON());
  }

  /**
   * Get active rules by trigger type
   */
  static async getActiveByTriggerType(triggerType: 'cron' | 'event'): Promise<AgentRuleDocument[]> {
    const db = await getDatabase();
    const docs = await db.agent_rules
      .find({
        selector: {
          trigger_type: triggerType,
          is_active: true
        }
      })
      .exec();
    return docs.map(doc => doc.toJSON());
  }
}
