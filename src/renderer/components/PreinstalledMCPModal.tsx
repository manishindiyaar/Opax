import React, { useState, useEffect } from 'react';
import './PreinstalledMCPModal.css';

interface MCPServerInfo {
  id: string;
  name: string;
  scriptPath: string;
  status: string;
  toolCount: number;
  tools: Array<{ name: string; description: string }>;
}

interface PreinstalledServer {
  key: string;
  name: string;
  url: string;
  description: string;
}

const PREINSTALLED_SERVERS: PreinstalledServer[] = [
  {
    key: 'clinical-pms',
    name: 'Clinical PMS',
    url: 'https://clinicaltools.vercel.app/api/mcp/pms',
    description: 'Patient Management System',
  },
  {
    key: 'clinical-sas',
    name: 'Clinical SAS',
    url: 'https://clinicaltools.vercel.app/api/mcp/sas',
    description: 'Staff & Appointment Scheduling',
  },
  {
    key: 'clinical-lts',
    name: 'Clinical LTS',
    url: 'https://clinicaltools.vercel.app/api/mcp/lts',
    description: 'Lab & Test Services',
  },
];

interface PreinstalledMCPModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectedServers: MCPServerInfo[];
  onConnectHTTP: (url: string, name: string) => Promise<void>;
  onDisconnect: (serverId: string) => Promise<void>;
}

export const PreinstalledMCPModal: React.FC<PreinstalledMCPModalProps> = ({
  isOpen,
  onClose,
  connectedServers,
  onConnectHTTP,
  onDisconnect,
}) => {
  const [connectingKey, setConnectingKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedServer, setExpandedServer] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrors({});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getConnectedServer = (url: string): MCPServerInfo | undefined =>
    connectedServers.find(s => s.scriptPath === url);

  const handleConnect = async (server: PreinstalledServer) => {
    setConnectingKey(server.key);
    setErrors(prev => ({ ...prev, [server.key]: '' }));
    try {
      await onConnectHTTP(server.url, server.name);
    } catch (err) {
      setErrors(prev => ({
        ...prev,
        [server.key]: err instanceof Error ? err.message : 'Connection failed',
      }));
    } finally {
      setConnectingKey(null);
    }
  };

  const handleDisconnect = async (server: PreinstalledServer) => {
    const connected = getConnectedServer(server.url);
    if (connected) {
      await onDisconnect(connected.id);
    }
  };

  const handleConnectAll = async () => {
    for (const server of PREINSTALLED_SERVERS) {
      if (!getConnectedServer(server.url)) {
        await handleConnect(server);
      }
    }
  };

  const totalTools = PREINSTALLED_SERVERS.reduce((sum, s) => {
    const connected = getConnectedServer(s.url);
    return sum + (connected?.toolCount || 0);
  }, 0);

  const connectedCount = PREINSTALLED_SERVERS.filter(s => getConnectedServer(s.url)).length;

  return (
    <div className="preinstalled-modal__backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="preinstalled-modal" role="dialog" aria-modal="true" aria-labelledby="preinstalled-modal-title">
        <div className="preinstalled-modal__header">
          <div className="preinstalled-modal__title-row">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            <h2 id="preinstalled-modal-title">Preinstalled MCP Servers</h2>
          </div>
          <div className="preinstalled-modal__stats">
            <span className="preinstalled-modal__stat">{connectedCount}/{PREINSTALLED_SERVERS.length} connected</span>
            {totalTools > 0 && <span className="preinstalled-modal__stat preinstalled-modal__stat--tools">{totalTools} tools available</span>}
          </div>
          <button className="preinstalled-modal__close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="preinstalled-modal__content">
          {connectedCount < PREINSTALLED_SERVERS.length && (
            <button className="preinstalled-modal__connect-all" onClick={handleConnectAll} disabled={connectingKey !== null}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Connect All
            </button>
          )}

          <ul className="preinstalled-modal__list">
            {PREINSTALLED_SERVERS.map((server) => {
              const connected = getConnectedServer(server.url);
              const isConnecting = connectingKey === server.key;
              const error = errors[server.key];
              const isExpanded = expandedServer === server.key;

              return (
                <li key={server.key} className={`preinstalled-modal__item ${connected ? 'preinstalled-modal__item--connected' : ''}`}>
                  <div className="preinstalled-modal__item-header">
                    <div className="preinstalled-modal__item-info">
                      <span className={`preinstalled-modal__status-dot ${connected ? 'preinstalled-modal__status-dot--on' : ''}`} />
                      <div>
                        <div className="preinstalled-modal__item-name">{server.name}</div>
                        <div className="preinstalled-modal__item-desc">{server.description}</div>
                      </div>
                    </div>
                    <div className="preinstalled-modal__item-actions">
                      {connected && (
                        <span className="preinstalled-modal__tool-badge">{connected.toolCount} tools</span>
                      )}
                      {connected ? (
                        <>
                          {connected.tools.length > 0 && (
                            <button
                              className="preinstalled-modal__expand-btn"
                              onClick={() => setExpandedServer(isExpanded ? null : server.key)}
                              aria-label="Toggle tools"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </button>
                          )}
                          <button
                            className="preinstalled-modal__disconnect-btn"
                            onClick={() => handleDisconnect(server)}
                            aria-label={`Disconnect ${server.name}`}
                          >
                            Disconnect
                          </button>
                        </>
                      ) : (
                        <button
                          className="preinstalled-modal__connect-btn"
                          onClick={() => handleConnect(server)}
                          disabled={isConnecting}
                          aria-label={`Connect ${server.name}`}
                        >
                          {isConnecting ? (
                            <><span className="preinstalled-modal__spinner" />Connecting...</>
                          ) : 'Connect'}
                        </button>
                      )}
                    </div>
                  </div>

                  {error && <p className="preinstalled-modal__error">{error}</p>}

                  {isExpanded && connected && connected.tools.length > 0 && (
                    <div className="preinstalled-modal__tools">
                      {connected.tools.map((tool) => (
                        <div key={tool.name} className="preinstalled-modal__tool">
                          <span className="preinstalled-modal__tool-name">{tool.name}</span>
                          {tool.description && (
                            <span className="preinstalled-modal__tool-desc">{tool.description}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="preinstalled-modal__footer">
          <button className="preinstalled-modal__close-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default PreinstalledMCPModal;
