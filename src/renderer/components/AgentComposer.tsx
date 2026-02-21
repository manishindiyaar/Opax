/**
 * AgentComposer - UI for creating and managing Agent Rules
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import { useState, useEffect } from 'react';
import './AgentComposer.css';
import { AgentRule } from '../../preload/index';
import { DebugConsole } from './DebugConsole';
import { PDFAutomationPanel } from './PDFAutomationPanel';

interface AgentComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDebugConsole?: () => void;
}

type Mode = 'list' | 'create' | 'edit' | 'manual' | 'debug' | 'pdf-automation';

export function AgentComposer({ isOpen, onClose }: AgentComposerProps) {
  const [mode, setMode] = useState<Mode>('list');
  const [rules, setRules] = useState<AgentRule[]>([]);
  const [selectedRule, setSelectedRule] = useState<AgentRule | null>(null);
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
  const [generatedBlueprint, setGeneratedBlueprint] = useState<Partial<AgentRule> | null>(null);
  const [manualBlueprint, setManualBlueprint] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load rules when modal opens
  useEffect(() => {
    if (isOpen) {
      loadRules();
    }
  }, [isOpen]);

  const loadRules = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await window.api.agent.listRules();
      if (result.success) {
        setRules(result.rules);
      } else {
        setError(result.error || 'Failed to load rules');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rules');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateBlueprint = async () => {
    if (!naturalLanguageInput.trim()) {
      setError('Please enter a description');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Get available MCP tools
      const tools = await window.api.mcp.listTools();
      
      // Create prompt for AI
      const prompt = `You are an automation blueprint generator. Generate a JSON blueprint for an Agent Rule based on this description:

"${naturalLanguageInput}"

Available MCP tools:
${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

Generate a JSON object with this structure:
{
  "name": "Short name for the rule",
  "description": "Detailed description",
  "trigger_type": "cron" or "event",
  "cron_expression": "CRON expression if trigger_type is cron",
  "polling_config": {
    "mcp_server": "server_id",
    "tool_name": "tool_name",
    "interval_seconds": 60,
    "cursor_field": "id"
  } (if trigger_type is event),
  "steps": [
    {
      "id": "step1",
      "type": "action",
      "mcp_server": "server_id",
      "tool_name": "tool_name",
      "args_template": { "arg": "{{trigger.value}}" }
    }
  ],
  "is_active": true,
  "last_run_status": null,
  "consecutive_failures": 0
}

Return ONLY the JSON, no explanation.`;

      const response = await window.api.chat.send(prompt);
      
      // Parse JSON from response
      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const blueprint = JSON.parse(jsonMatch[0]);
        setGeneratedBlueprint(blueprint);
        setError(null);
      } else {
        setError('Failed to parse blueprint from AI response');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate blueprint');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateRule = async () => {
    if (!generatedBlueprint) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.api.agent.createRule(generatedBlueprint as Omit<AgentRule, 'id' | 'created_at' | 'updated_at'>);
      
      if (result.success) {
        await loadRules();
        setMode('list');
        setNaturalLanguageInput('');
        setGeneratedBlueprint(null);
      } else {
        setError(result.error || 'Failed to create rule');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rule');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateManualRule = async () => {
    if (!manualBlueprint.trim()) {
      setError('Please enter a blueprint');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const blueprint = JSON.parse(manualBlueprint);
      const result = await window.api.agent.createRule(blueprint);
      
      if (result.success) {
        await loadRules();
        setMode('list');
        setManualBlueprint('');
      } else {
        setError(result.error || 'Failed to create rule');
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON: ' + err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create rule');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleRule = async (ruleId: string) => {
    setError(null);
    try {
      const result = await window.api.agent.toggleRule(ruleId);
      if (result.success) {
        await loadRules();
      } else {
        setError(result.error || 'Failed to toggle rule');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle rule');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    setError(null);
    try {
      const result = await window.api.agent.deleteRule(ruleId);
      if (result.success) {
        await loadRules();
      } else {
        setError(result.error || 'Failed to delete rule');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="agent-composer-overlay">
      <div className="agent-composer">
        <div className="agent-composer__header">
          <h2>Agent Box</h2>
          <div className="agent-composer__tabs">
            <button
              className={`agent-composer__tab ${mode === 'list' || mode === 'create' || mode === 'manual' ? 'agent-composer__tab--active' : ''}`}
              onClick={() => setMode('list')}
            >
              Rules
            </button>
            <button
              className={`agent-composer__tab ${mode === 'pdf-automation' ? 'agent-composer__tab--active' : ''}`}
              onClick={() => setMode('pdf-automation')}
            >
              PDF Watch
            </button>
            <button
              className={`agent-composer__tab ${mode === 'debug' ? 'agent-composer__tab--active' : ''}`}
              onClick={() => setMode('debug')}
            >
              Debug Console
            </button>
          </div>
          <button onClick={onClose} className="agent-composer__close">×</button>
        </div>

        {error && mode !== 'debug' && (
          <div className="agent-composer__error">
            {error}
          </div>
        )}

        {mode === 'debug' && (
          <div className="agent-composer__debug-container">
            <DebugConsole isOpen={true} onClose={() => setMode('list')} embedded={true} />
          </div>
        )}

        {mode === 'pdf-automation' && (
          <div className="agent-composer__content">
            <PDFAutomationPanel embedded={true} />
          </div>
        )}

        {mode === 'list' && (
          <div className="agent-composer__content">
            <div className="agent-composer__toolbar">
              <button onClick={() => setMode('create')} className="agent-composer__btn agent-composer__btn--primary">
                + New Rule (AI)
              </button>
              <button onClick={() => setMode('manual')} className="agent-composer__btn">
                + Manual Rule
              </button>
            </div>

            {isLoading ? (
              <div className="agent-composer__loading">Loading rules...</div>
            ) : rules.length === 0 ? (
              <div className="agent-composer__empty">
                <p>No automation rules yet.</p>
                <p>Create your first rule to get started!</p>
              </div>
            ) : (
              <div className="agent-composer__list">
                {rules.map(rule => (
                  <div key={rule.id} className="agent-rule-card">
                    <div className="agent-rule-card__header">
                      <h3>{rule.name}</h3>
                      <div className="agent-rule-card__actions">
                        <label className="agent-rule-card__toggle">
                          <input
                            type="checkbox"
                            checked={rule.is_active}
                            onChange={() => handleToggleRule(rule.id)}
                          />
                          <span className="agent-rule-card__toggle-slider" />
                        </label>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="agent-rule-card__delete"
                          title="Delete rule"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <p className="agent-rule-card__description">{rule.description}</p>
                    <div className="agent-rule-card__meta">
                      <span className="agent-rule-card__badge">
                        {rule.trigger_type === 'cron' ? '⏰ CRON' : '🔄 Polling'}
                      </span>
                      {rule.last_run_status && (
                        <span className={`agent-rule-card__status agent-rule-card__status--${rule.last_run_status}`}>
                          {rule.last_run_status === 'success' ? '✓' : rule.last_run_status === 'failed' ? '✗' : '⋯'} {rule.last_run_status}
                        </span>
                      )}
                      {rule.consecutive_failures > 0 && (
                        <span className="agent-rule-card__failures">
                          ⚠️ {rule.consecutive_failures} failures
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {mode === 'create' && (
          <div className="agent-composer__content">
            <button onClick={() => setMode('list')} className="agent-composer__back">
              ← Back to List
            </button>

            <div className="agent-composer__form">
              <h3>Describe Your Automation</h3>
              <p className="agent-composer__hint">
                Examples: "Every morning at 8:30 AM, send me a summary of new patients" or "When a critical lab result comes in, notify the on-call doctor"
              </p>
              
              <textarea
                className="agent-composer__textarea"
                value={naturalLanguageInput}
                onChange={(e) => setNaturalLanguageInput(e.target.value)}
                placeholder="Describe what you want to automate..."
                rows={4}
                disabled={isGenerating}
              />

              <button
                onClick={handleGenerateBlueprint}
                className="agent-composer__btn agent-composer__btn--primary"
                disabled={isGenerating || !naturalLanguageInput.trim()}
              >
                {isGenerating ? 'Generating...' : 'Generate Blueprint'}
              </button>

              {generatedBlueprint && (
                <div className="agent-composer__blueprint">
                  <h4>Generated Blueprint</h4>
                  <pre>{JSON.stringify(generatedBlueprint, null, 2)}</pre>
                  <div className="agent-composer__blueprint-actions">
                    <button
                      onClick={handleCreateRule}
                      className="agent-composer__btn agent-composer__btn--primary"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Creating...' : 'Create Rule'}
                    </button>
                    <button
                      onClick={() => setGeneratedBlueprint(null)}
                      className="agent-composer__btn"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {mode === 'manual' && (
          <div className="agent-composer__content">
            <button onClick={() => setMode('list')} className="agent-composer__back">
              ← Back to List
            </button>

            <div className="agent-composer__form">
              <h3>Manual Blueprint Editor</h3>
              <p className="agent-composer__hint">
                Enter a valid Agent Rule JSON blueprint
              </p>
              
              <textarea
                className="agent-composer__textarea agent-composer__textarea--code"
                value={manualBlueprint}
                onChange={(e) => setManualBlueprint(e.target.value)}
                placeholder='{\n  "name": "My Rule",\n  "description": "...",\n  ...\n}'
                rows={20}
              />

              <button
                onClick={handleCreateManualRule}
                className="agent-composer__btn agent-composer__btn--primary"
                disabled={isLoading || !manualBlueprint.trim()}
              >
                {isLoading ? 'Creating...' : 'Create Rule'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
