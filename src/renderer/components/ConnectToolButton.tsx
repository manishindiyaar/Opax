import React, { useState, useRef, useEffect } from 'react';
import './ConnectToolButton.css';

interface ConnectToolButtonProps {
  onClick: () => void;
  onPreinstalled: () => void;
  connectedCount: number;
}

export const ConnectToolButton: React.FC<ConnectToolButtonProps> = ({
  onClick,
  onPreinstalled,
  connectedCount,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="tool-btn-root" ref={ref}>
      <button
        className={`tool-btn ${open ? 'tool-btn--open' : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-label="Tools"
        title="Tools"
      >
        {/* Plug icon */}
        <svg className="tool-btn__plug" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22v-5" />
          <path d="M9 8V2" />
          <path d="M15 8V2" />
          <path d="M18 8H6a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2z" />
        </svg>

        <span className="tool-btn__label">Tools</span>

        {connectedCount > 0 && (
          <span className="tool-btn__badge">{connectedCount}</span>
        )}

        {/* Chevron */}
        <svg
          className={`tool-btn__chevron ${open ? 'tool-btn__chevron--up' : ''}`}
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown */}
      <div className={`tool-btn__dropdown ${open ? 'tool-btn__dropdown--visible' : ''}`}>
        <button
          className="tool-btn__item"
          onClick={() => { setOpen(false); onClick(); }}
        >
          <span className="tool-btn__item-icon tool-btn__item-icon--blue">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </span>
          <div>
            <div className="tool-btn__item-title">Connect Server</div>
            <div className="tool-btn__item-sub">Add a custom MCP server</div>
          </div>
        </button>

        <div className="tool-btn__divider" />

        <button
          className="tool-btn__item"
          onClick={() => { setOpen(false); onPreinstalled(); }}
        >
          <span className="tool-btn__item-icon tool-btn__item-icon--indigo">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </span>
          <div>
            <div className="tool-btn__item-title">Preinstalled MCP</div>
            <div className="tool-btn__item-sub">Clinical tools — ready to connect</div>
          </div>
        </button>
      </div>
    </div>
  );
};

export default ConnectToolButton;
