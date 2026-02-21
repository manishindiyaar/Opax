/**
 * DebugConsole - Terminal-style log viewer for Agent Box
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

/// <reference path="../../preload/index.d.ts" />

import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import './DebugConsole.css';

interface DebugConsoleProps {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
}

// ANSI color codes for log levels
const LOG_COLORS = {
  INFO: '\x1b[37m',     // White
  SUCCESS: '\x1b[32m',  // Green
  ERROR: '\x1b[31m',    // Red
  TRIGGER: '\x1b[36m',  // Cyan
  DEBUG: '\x1b[90m',    // Gray
  RESET: '\x1b[0m',     // Reset
};

export function DebugConsole({ isOpen, onClose, embedded = false }: DebugConsoleProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize terminal
  useEffect(() => {
    if (!isOpen || !terminalRef.current || isInitialized) return;

    // Create terminal instance
    const terminal = new Terminal({
      cursorBlink: false,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1a1a1a',
        foreground: '#e0e0e0',
        cursor: '#00ff00',
        black: '#000000',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#bd93f9',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#bfbfbf',
        brightBlack: '#4d4d4d',
        brightRed: '#ff6e67',
        brightGreen: '#5af78e',
        brightYellow: '#f4f99d',
        brightBlue: '#caa9fa',
        brightMagenta: '#ff92d0',
        brightCyan: '#9aedfe',
        brightWhite: '#e6e6e6',
      },
      rows: 24,
      scrollback: 1000,
    });

    // Create fit addon
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // Open terminal
    terminal.open(terminalRef.current);
    fitAddon.fit();

    // Store references
    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;
    setIsInitialized(true);

    // Welcome message
    terminal.writeln('\x1b[36m╔════════════════════════════════════════════════════════════╗\x1b[0m');
    terminal.writeln('\x1b[36m║           Agent Box Debug Console - v1.0.0                ║\x1b[0m');
    terminal.writeln('\x1b[36m╚════════════════════════════════════════════════════════════╝\x1b[0m');
    terminal.writeln('');
    terminal.writeln('\x1b[90mListening for agent events...\x1b[0m');
    terminal.writeln('');

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
      terminalInstanceRef.current = null;
      fitAddonRef.current = null;
      setIsInitialized(false);
    };
  }, [isOpen, isInitialized]);

  // Listen for agent log events
  useEffect(() => {
    if (!isInitialized || !terminalInstanceRef.current) return;

    const terminal = terminalInstanceRef.current;

    const handleLog = (log: {
      timestamp: string;
      level: 'INFO' | 'SUCCESS' | 'ERROR' | 'TRIGGER' | 'DEBUG';
      source: string;
      agent_id?: string;
      event: string;
      payload?: Record<string, unknown>;
    }) => {
      // Format timestamp
      const time = new Date(log.timestamp).toLocaleTimeString();
      
      // Get color for level
      const color = LOG_COLORS[log.level] || LOG_COLORS.INFO;
      
      // Format log line
      let line = `${color}[${time}] [${log.level.padEnd(7)}] [${log.source}]${LOG_COLORS.RESET} `;
      
      if (log.agent_id) {
        line += `\x1b[33m[${log.agent_id.substring(0, 8)}]\x1b[0m `;
      }
      
      line += log.event;
      
      // Add payload if present
      if (log.payload && Object.keys(log.payload).length > 0) {
        line += ` ${LOG_COLORS.DEBUG}${JSON.stringify(log.payload)}${LOG_COLORS.RESET}`;
      }
      
      terminal.writeln(line);
    };

    // Subscribe to agent log events
    window.api.agent.onLog(handleLog);

    // Note: No cleanup needed as we can't unsubscribe from IPC events easily
    // The terminal will be disposed when component unmounts
  }, [isInitialized]);

  const handleClear = () => {
    if (terminalInstanceRef.current) {
      terminalInstanceRef.current.clear();
      terminalInstanceRef.current.writeln('\x1b[90mConsole cleared.\x1b[0m');
      terminalInstanceRef.current.writeln('');
    }
  };

  if (!isOpen) return null;

  const content = (
    <>
      {!embedded && (
        <div className="debug-console__header">
          <h2>Debug Console</h2>
          <div className="debug-console__actions">
            <button onClick={handleClear} className="debug-console__btn">
              Clear
            </button>
            <button onClick={onClose} className="debug-console__btn debug-console__btn--close">
              ×
            </button>
          </div>
        </div>
      )}
      {embedded && (
        <div className="debug-console__header debug-console__header--embedded">
          <div className="debug-console__actions">
            <button onClick={handleClear} className="debug-console__btn">
              Clear
            </button>
          </div>
        </div>
      )}
      <div className="debug-console__terminal" ref={terminalRef} />
    </>
  );

  if (embedded) {
    return <div className="debug-console debug-console--embedded">{content}</div>;
  }

  return (
    <div className="debug-console-overlay">
      <div className="debug-console">
        {content}
      </div>
    </div>
  );
}
