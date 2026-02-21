/**
 * AgentComposer - Coming Soon placeholder
 */

import './AgentComposer.css';

interface AgentComposerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AgentComposer({ isOpen, onClose }: AgentComposerProps) {
  if (!isOpen) return null;

  return (
    <div className="agent-composer__overlay" onClick={onClose}>
      <div className="agent-composer" onClick={e => e.stopPropagation()}>
        <div className="agent-composer__header">
          <h2 className="agent-composer__title">AgentBox</h2>
          <button onClick={onClose} className="agent-composer__close">×</button>
        </div>
        <div className="agent-composer__coming-soon">
          <div className="agent-composer__coming-soon-icon">🤖</div>
          <h3>We are working on this AgentBox feature</h3>
          <p>Coming soon.</p>
        </div>
      </div>
    </div>
  );
}

export default AgentComposer;
