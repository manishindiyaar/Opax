/**
 * PDFAutomationPanel - UI for configuring PDF Watch & Summarize automation
 * Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 6.1, 6.3, 6.4, 7.1, 7.2, 7.3, 7.5
 * 
 * This component provides:
 * - Directory path input with folder picker button
 * - Email address input with validation
 * - Enable/disable toggle
 * - Status indicator (active/inactive/error)
 * - Configuration persistence
 * - Collapsible SMTP configuration section with presets
 * - Processing history list with status, filename, timestamp
 */

/// <reference path="../../preload/index.d.ts" />

import { useState, useEffect, useCallback } from 'react';
import './PDFAutomationPanel.css';

// Types from preload API
interface AutomationStatus {
  enabled: boolean;
  directoryPath: string | null;
  recipientEmail: string | null;
  isWatching: boolean;
  emailConfigured: boolean;
  error?: string;
}

interface AutomationConfig {
  directoryPath: string;
  recipientEmail: string;
  enabled: boolean;
}

/** Resend API configuration */
interface ResendConfig {
  apiKey: string;
  fromEmail: string;
}

interface EmailConfigStatus {
  configured: boolean;
  fromEmail?: string;
}

/** Processing history entry for tracking PDF processing (Requirements: 7.1, 7.2) */
interface ProcessingHistoryEntry {
  id: string;
  filename: string;
  filePath: string;
  status: 'pending' | 'extracting' | 'summarizing' | 'sending' | 'completed' | 'failed';
  summary?: string;
  error?: string;
  pageCount?: number;
  wordCount?: number;
  startedAt: number;
  completedAt?: number;
  emailSentAt?: number;
}

interface PDFAutomationPanelProps {
  /** If true, don't show close button (for embedding in other components) */
  embedded?: boolean;
  /** Callback when panel is closed (only used when not embedded) */
  onClose?: () => void;
}

/**
 * Resend API link for getting API keys
 */
const RESEND_API_KEYS_URL = 'https://resend.com/api-keys';

/**
 * Validates email address format using a basic regex pattern
 * Validates: Requirements 1.3
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  // Basic email validation regex - matches most common email formats
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

export function PDFAutomationPanel({ embedded = false, onClose }: PDFAutomationPanelProps) {
  // Configuration state
  const [directoryPath, setDirectoryPath] = useState<string>('');
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [enabled, setEnabled] = useState<boolean>(false);
  
  // UI state
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Resend API configuration state (Requirements: 6.1)
  const [emailExpanded, setEmailExpanded] = useState<boolean>(false);
  const [resendApiKey, setResendApiKey] = useState<string>('');
  const [fromEmail, setFromEmail] = useState<string>('onboarding@resend.dev');
  const [emailConfigStatus, setEmailConfigStatus] = useState<EmailConfigStatus | null>(null);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSavingEmail, setIsSavingEmail] = useState<boolean>(false);

  // Processing history state (Requirements: 7.1, 7.2, 7.3, 7.5)
  const [historyExpanded, setHistoryExpanded] = useState<boolean>(false);
  const [historyEntries, setHistoryEntries] = useState<ProcessingHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [selectedEntry, setSelectedEntry] = useState<ProcessingHistoryEntry | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState<boolean>(false);

  /**
   * Load processing history entries
   * Validates: Requirements 7.1, 7.2
   */
  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const entries = await window.api.pdfAutomation.getHistory(50);
      setHistoryEntries(entries);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  /**
   * Load saved configuration on mount
   * Validates: Requirements 1.4 (loading persisted config)
   */
  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Load saved configuration
      const config = await window.api.pdfAutomation.getConfig();
      if (config) {
        setDirectoryPath(config.directoryPath || '');
        setRecipientEmail(config.recipientEmail || '');
        setEnabled(config.enabled || false);
      }
      
      // Load current status
      const currentStatus = await window.api.pdfAutomation.getStatus();
      setStatus(currentStatus);

      // Load Resend API configuration status (Requirements: 6.1)
      const emailStatus = await window.api.email.getConfigStatus();
      setEmailConfigStatus({
        configured: emailStatus.configured,
        fromEmail: emailStatus.user,
      });
      
      // If email is configured, populate the from email field
      if (emailStatus.configured && emailStatus.user) {
        setFromEmail(emailStatus.user);
      }

      // Load processing history (Requirements: 7.1)
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setIsLoading(false);
    }
  }, [loadHistory]);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Set up status change listener
  useEffect(() => {
    const handleStatusChange = (newStatus: AutomationStatus) => {
      setStatus(newStatus);
      // If there's an error in status, show it
      if (newStatus.error) {
        setError(newStatus.error);
      }
    };

    window.api.pdfAutomation.onStatusChange(handleStatusChange);
    
    // Note: In a real implementation, we'd want to clean up the listener
    // but the preload API doesn't expose a removeListener method
  }, []);

  // Set up processing event listeners (Requirements: 7.1, 7.2)
  useEffect(() => {
    const handleProcessingStarted = (entry: ProcessingHistoryEntry) => {
      setHistoryEntries(prev => [entry, ...prev].slice(0, 50));
    };

    const handleProcessingCompleted = (entry: ProcessingHistoryEntry) => {
      setHistoryEntries(prev => 
        prev.map(e => e.id === entry.id ? entry : e)
      );
    };

    const handleProcessingFailed = (entry: ProcessingHistoryEntry) => {
      setHistoryEntries(prev => 
        prev.map(e => e.id === entry.id ? entry : e)
      );
    };

    window.api.pdfAutomation.onProcessingStarted(handleProcessingStarted);
    window.api.pdfAutomation.onProcessingCompleted(handleProcessingCompleted);
    window.api.pdfAutomation.onProcessingFailed(handleProcessingFailed);
  }, []);

  /**
   * Handle directory selection via native folder picker
   * Validates: Requirements 1.2
   */
  const handleSelectDirectory = async () => {
    try {
      const result = await window.api.pdfAutomation.selectDirectory();
      if (!result.canceled && result.path) {
        setDirectoryPath(result.path);
        setHasUnsavedChanges(true);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open folder picker');
    }
  };

  /**
   * Handle email input change with validation
   * Validates: Requirements 1.3
   */
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    setRecipientEmail(email);
    setHasUnsavedChanges(true);
    
    // Validate email format
    if (email && !validateEmail(email)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError(null);
    }
  };

  /**
   * Handle directory path manual input
   */
  const handleDirectoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDirectoryPath(e.target.value);
    setHasUnsavedChanges(true);
  };

  /**
   * Handle enable/disable toggle
   * Validates: Requirements 1.5, 1.6
   */
  const handleToggleEnabled = async () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    
    // Auto-save when toggling
    await saveConfiguration(newEnabled);
  };

  /**
   * Save configuration and start/stop automation
   * Validates: Requirements 1.4, 1.5, 1.6
   */
  const saveConfiguration = async (enabledOverride?: boolean) => {
    const isEnabled = enabledOverride !== undefined ? enabledOverride : enabled;
    
    // Validate before saving
    if (isEnabled) {
      if (!directoryPath) {
        setError('Please select a directory to watch');
        return;
      }
      if (!recipientEmail) {
        setError('Please enter an email address');
        return;
      }
      if (!validateEmail(recipientEmail)) {
        setEmailError('Please enter a valid email address');
        return;
      }
    }

    setIsSaving(true);
    setError(null);

    try {
      const config: AutomationConfig = {
        directoryPath,
        recipientEmail,
        enabled: isEnabled,
      };

      const result = await window.api.pdfAutomation.configure(config);
      
      if (result.success) {
        setHasUnsavedChanges(false);
        // Refresh status
        const newStatus = await window.api.pdfAutomation.getStatus();
        setStatus(newStatus);
      } else {
        setError(result.error || 'Failed to save configuration');
        // Revert enabled state if save failed
        if (enabledOverride !== undefined) {
          setEnabled(!enabledOverride);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
      // Revert enabled state if save failed
      if (enabledOverride !== undefined) {
        setEnabled(!enabledOverride);
      }
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle manual save button click
   */
  const handleSave = () => {
    saveConfiguration();
  };

  /**
   * Get status indicator class and text
   * Validates: Requirements 1.5, 1.6
   */
  const getStatusInfo = (): { className: string; text: string; icon: string } => {
    if (!status) {
      return { className: 'pdf-automation__status--loading', text: 'Loading...', icon: '⏳' };
    }
    
    if (status.error) {
      return { className: 'pdf-automation__status--error', text: 'Error', icon: '❌' };
    }
    
    if (status.enabled && status.isWatching) {
      return { className: 'pdf-automation__status--active', text: 'Active', icon: '✅' };
    }
    
    if (status.enabled && !status.isWatching) {
      return { className: 'pdf-automation__status--warning', text: 'Starting...', icon: '⏳' };
    }
    
    return { className: 'pdf-automation__status--inactive', text: 'Inactive', icon: '⏸️' };
  };

  /**
   * Handle from email input change
   */
  const handleFromEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFromEmail(e.target.value);
    setSaveResult(null);
  };

  /**
   * Handle API key input change
   */
  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setResendApiKey(e.target.value);
    setSaveResult(null);
  };

  /**
   * Save Resend API configuration
   * Requirements: 6.1, 6.2
   */
  const handleSaveEmailConfig = async () => {
    if (!resendApiKey) {
      setSaveResult({
        success: false,
        message: 'Please enter your Resend API key',
      });
      return;
    }

    setIsSavingEmail(true);
    setSaveResult(null);

    try {
      const config: ResendConfig = {
        apiKey: resendApiKey,
        fromEmail: fromEmail || 'onboarding@resend.dev',
      };

      const result = await window.api.email.configure(config);
      
      if (result.success) {
        setSaveResult({
          success: true,
          message: 'API key saved!',
        });
        // Refresh config status
        const newStatus = await window.api.email.getConfigStatus();
        setEmailConfigStatus({
          configured: newStatus.configured,
          fromEmail: newStatus.user,
        });
      } else {
        setSaveResult({
          success: false,
          message: result.error || 'Failed to save',
        });
      }
    } catch (err) {
      setSaveResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to save',
      });
    } finally {
      setIsSavingEmail(false);
    }
  };

  /**
   * Toggle email section expand/collapse
   */
  const toggleEmailSection = () => {
    setEmailExpanded(!emailExpanded);
  };

  /**
   * Toggle history section expand/collapse
   * Requirements: 7.1
   */
  const toggleHistorySection = () => {
    setHistoryExpanded(!historyExpanded);
    // Load history when expanding if not already loaded
    if (!historyExpanded && historyEntries.length === 0) {
      loadHistory();
    }
  };

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * Get status badge info for history entry
   * Requirements: 7.2
   */
  const getHistoryStatusInfo = (status: ProcessingHistoryEntry['status']): { className: string; text: string; icon: string } => {
    switch (status) {
      case 'pending':
        return { className: 'pdf-automation__history-status--pending', text: 'Pending', icon: '⏳' };
      case 'extracting':
        return { className: 'pdf-automation__history-status--processing', text: 'Extracting', icon: '📄' };
      case 'summarizing':
        return { className: 'pdf-automation__history-status--processing', text: 'Summarizing', icon: '🤖' };
      case 'sending':
        return { className: 'pdf-automation__history-status--processing', text: 'Sending', icon: '📧' };
      case 'completed':
        return { className: 'pdf-automation__history-status--completed', text: 'Completed', icon: '✅' };
      case 'failed':
        return { className: 'pdf-automation__history-status--failed', text: 'Failed', icon: '❌' };
      default:
        return { className: '', text: status, icon: '❓' };
    }
  };

  /**
   * Handle clicking on a history entry to view summary
   * Requirements: 7.3
   */
  const handleViewSummary = (entry: ProcessingHistoryEntry) => {
    setSelectedEntry(entry);
    setShowSummaryModal(true);
  };

  /**
   * Close the summary modal
   */
  const closeSummaryModal = () => {
    setShowSummaryModal(false);
    setSelectedEntry(null);
  };

  /**
   * Clear all processing history
   */
  const handleClearHistory = async () => {
    if (!confirm('Are you sure you want to clear all processing history?')) {
      return;
    }
    try {
      await window.api.pdfAutomation.clearHistory();
      setHistoryEntries([]);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  const statusInfo = getStatusInfo();

  if (isLoading) {
    return (
      <div className={`pdf-automation ${embedded ? 'pdf-automation--embedded' : ''}`}>
        <div className="pdf-automation__loading">
          <span className="pdf-automation__spinner" />
          Loading configuration...
        </div>
      </div>
    );
  }

  return (
    <div className={`pdf-automation ${embedded ? 'pdf-automation--embedded' : ''}`}>
      {/* Header */}
      <div className="pdf-automation__header">
        <div className="pdf-automation__title-row">
          <h3 className="pdf-automation__title">📄 PDF Watch & Summarize</h3>
          <div className={`pdf-automation__status ${statusInfo.className}`}>
            <span className="pdf-automation__status-icon">{statusInfo.icon}</span>
            <span className="pdf-automation__status-text">{statusInfo.text}</span>
          </div>
        </div>
        {!embedded && onClose && (
          <button onClick={onClose} className="pdf-automation__close">×</button>
        )}
      </div>

      {/* Description */}
      <p className="pdf-automation__description">
        Automatically monitor a folder for new PDF files, generate AI summaries, and send them to your email.
      </p>

      {/* Error display */}
      {error && (
        <div className="pdf-automation__error">
          <span className="pdf-automation__error-icon">⚠️</span>
          {error}
        </div>
      )}

      {/* Configuration form */}
      <div className="pdf-automation__form">
        {/* Directory path input */}
        <div className="pdf-automation__field">
          <label className="pdf-automation__label" htmlFor="directory-path">
            Watch Directory
          </label>
          <div className="pdf-automation__input-group">
            <input
              id="directory-path"
              type="text"
              className="pdf-automation__input pdf-automation__input--path"
              value={directoryPath}
              onChange={handleDirectoryChange}
              placeholder="Select a folder to watch..."
              disabled={isSaving}
            />
            <button
              type="button"
              className="pdf-automation__btn pdf-automation__btn--browse"
              onClick={handleSelectDirectory}
              disabled={isSaving}
            >
              Browse...
            </button>
          </div>
          <span className="pdf-automation__hint">
            New PDF files added to this folder will be automatically processed
          </span>
        </div>

        {/* Email address input */}
        <div className="pdf-automation__field">
          <label className="pdf-automation__label" htmlFor="recipient-email">
            Email Address
          </label>
          <input
            id="recipient-email"
            type="email"
            className={`pdf-automation__input ${emailError ? 'pdf-automation__input--error' : ''}`}
            value={recipientEmail}
            onChange={handleEmailChange}
            placeholder="your@email.com"
            disabled={isSaving}
          />
          {emailError && (
            <span className="pdf-automation__field-error">{emailError}</span>
          )}
          <span className="pdf-automation__hint">
            PDF summaries will be sent to this email address
          </span>
        </div>

        {/* Enable/Disable toggle */}
        <div className="pdf-automation__field pdf-automation__field--toggle">
          <div className="pdf-automation__toggle-row">
            <label className="pdf-automation__label" htmlFor="automation-toggle">
              Enable Automation
            </label>
            <label className="pdf-automation__toggle">
              <input
                id="automation-toggle"
                type="checkbox"
                checked={enabled}
                onChange={handleToggleEnabled}
                disabled={isSaving}
              />
              <span className="pdf-automation__toggle-slider" />
            </label>
          </div>
          <span className="pdf-automation__hint">
            {enabled 
              ? 'Automation is enabled - watching for new PDFs' 
              : 'Toggle to start watching for new PDF files'}
          </span>
        </div>

        {/* Save button (only show if there are unsaved changes and not auto-saving) */}
        {hasUnsavedChanges && !enabled && (
          <div className="pdf-automation__actions">
            <button
              type="button"
              className="pdf-automation__btn pdf-automation__btn--primary"
              onClick={handleSave}
              disabled={isSaving || !!emailError}
            >
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        )}
      </div>

      {/* Status details when active */}
      {status && status.enabled && (
        <div className="pdf-automation__status-details">
          <h4 className="pdf-automation__status-title">Status Details</h4>
          <div className="pdf-automation__status-grid">
            <div className="pdf-automation__status-item">
              <span className="pdf-automation__status-label">Directory:</span>
              <span className="pdf-automation__status-value">{status.directoryPath || 'Not set'}</span>
            </div>
            <div className="pdf-automation__status-item">
              <span className="pdf-automation__status-label">Email:</span>
              <span className="pdf-automation__status-value">{status.recipientEmail || 'Not set'}</span>
            </div>
            <div className="pdf-automation__status-item">
              <span className="pdf-automation__status-label">Watching:</span>
              <span className="pdf-automation__status-value">{status.isWatching ? 'Yes' : 'No'}</span>
            </div>
            <div className="pdf-automation__status-item">
              <span className="pdf-automation__status-label">Email Configured:</span>
              <span className="pdf-automation__status-value">{status.emailConfigured ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Resend API Configuration Section (Requirements: 6.1, 6.3) */}
      <div className="pdf-automation__smtp-section">
        <button
          type="button"
          className="pdf-automation__smtp-header"
          onClick={toggleEmailSection}
          aria-expanded={emailExpanded}
        >
          <div className="pdf-automation__smtp-header-content">
            <span className="pdf-automation__smtp-icon">📧</span>
            <span className="pdf-automation__smtp-title">Email Settings (Resend API)</span>
            {emailConfigStatus?.configured && (
              <span className="pdf-automation__smtp-badge pdf-automation__smtp-badge--configured">
                Configured
              </span>
            )}
            {!emailConfigStatus?.configured && (
              <span className="pdf-automation__smtp-badge pdf-automation__smtp-badge--not-configured">
                Not Configured
              </span>
            )}
          </div>
          <span className={`pdf-automation__smtp-chevron ${emailExpanded ? 'pdf-automation__smtp-chevron--expanded' : ''}`}>
            ▼
          </span>
        </button>

        <div className={`pdf-automation__smtp-content ${emailExpanded ? 'pdf-automation__smtp-content--expanded' : ''}`}>
          <p className="pdf-automation__smtp-description">
            We use{' '}
            <a href="https://resend.com" target="_blank" rel="noopener noreferrer">
              Resend
            </a>{' '}
            for email delivery. Get your free API key at{' '}
            <a href={RESEND_API_KEYS_URL} target="_blank" rel="noopener noreferrer">
              resend.com/api-keys
            </a>.
          </p>

          {/* Resend API Key */}
          <div className="pdf-automation__field">
            <label className="pdf-automation__label" htmlFor="resend-api-key">
              Resend API Key
            </label>
            <input
              id="resend-api-key"
              type="password"
              className="pdf-automation__input"
              value={resendApiKey}
              onChange={handleApiKeyChange}
              placeholder="re_xxxxxxxxxx"
              disabled={isSavingEmail}
            />
            <span className="pdf-automation__hint">
              Get your API key from{' '}
              <a href={RESEND_API_KEYS_URL} target="_blank" rel="noopener noreferrer">
                resend.com/api-keys
              </a>
            </span>
          </div>

          {/* From Email */}
          <div className="pdf-automation__field">
            <label className="pdf-automation__label" htmlFor="from-email">
              From Email
            </label>
            <input
              id="from-email"
              type="email"
              className="pdf-automation__input"
              value={fromEmail}
              onChange={handleFromEmailChange}
              placeholder="onboarding@resend.dev"
              disabled={isSavingEmail}
            />
            <span className="pdf-automation__hint">
              Use onboarding@resend.dev for testing, or add your own domain in Resend
            </span>
          </div>

          {/* Save result */}
          {saveResult && (
            <div
              className={`pdf-automation__test-result ${
                saveResult.success
                  ? 'pdf-automation__test-result--success'
                  : 'pdf-automation__test-result--error'
              }`}
            >
              <span className="pdf-automation__test-result-icon">
                {saveResult.success ? '✅' : '❌'}
              </span>
              <span className="pdf-automation__test-result-message">
                {saveResult.message}
              </span>
            </div>
          )}

          {/* Save button */}
          <div className="pdf-automation__smtp-actions">
            <button
              type="button"
              className="pdf-automation__btn pdf-automation__btn--primary"
              onClick={handleSaveEmailConfig}
              disabled={isSavingEmail || !resendApiKey}
            >
              {isSavingEmail ? 'Saving...' : 'Save API Key'}
            </button>
          </div>
        </div>
      </div>

      {/* Processing History Section (Requirements: 7.1, 7.2, 7.3, 7.5) */}
      <div className="pdf-automation__history-section">
        <button
          type="button"
          className="pdf-automation__history-header"
          onClick={toggleHistorySection}
          aria-expanded={historyExpanded}
        >
          <div className="pdf-automation__history-header-content">
            <span className="pdf-automation__history-icon">📋</span>
            <span className="pdf-automation__history-title">Processing History</span>
            {historyEntries.length > 0 && (
              <span className="pdf-automation__history-count">
                {historyEntries.length}
              </span>
            )}
          </div>
          <span className={`pdf-automation__history-chevron ${historyExpanded ? 'pdf-automation__history-chevron--expanded' : ''}`}>
            ▼
          </span>
        </button>

        <div className={`pdf-automation__history-content ${historyExpanded ? 'pdf-automation__history-content--expanded' : ''}`}>
          {isLoadingHistory ? (
            <div className="pdf-automation__history-loading">
              <span className="pdf-automation__spinner" />
              Loading history...
            </div>
          ) : historyEntries.length === 0 ? (
            <div className="pdf-automation__history-empty">
              <span className="pdf-automation__history-empty-icon">📄</span>
              <p>No PDFs processed yet</p>
              <p className="pdf-automation__history-empty-hint">
                Enable the automation and add PDF files to the watched directory
              </p>
            </div>
          ) : (
            <>
              <div className="pdf-automation__history-actions">
                <button
                  type="button"
                  className="pdf-automation__btn pdf-automation__btn--small"
                  onClick={loadHistory}
                  disabled={isLoadingHistory}
                >
                  Refresh
                </button>
                <button
                  type="button"
                  className="pdf-automation__btn pdf-automation__btn--small pdf-automation__btn--danger"
                  onClick={handleClearHistory}
                  disabled={isLoadingHistory}
                >
                  Clear All
                </button>
              </div>
              <div className="pdf-automation__history-list">
                {historyEntries.map(entry => {
                  const statusInfo = getHistoryStatusInfo(entry.status);
                  return (
                    <div
                      key={entry.id}
                      className={`pdf-automation__history-item ${entry.status === 'completed' ? 'pdf-automation__history-item--clickable' : ''}`}
                      onClick={() => entry.status === 'completed' && handleViewSummary(entry)}
                      role={entry.status === 'completed' ? 'button' : undefined}
                      tabIndex={entry.status === 'completed' ? 0 : undefined}
                    >
                      <div className="pdf-automation__history-item-main">
                        <span className="pdf-automation__history-item-icon">📄</span>
                        <div className="pdf-automation__history-item-info">
                          <span className="pdf-automation__history-item-filename" title={entry.filename}>
                            {entry.filename}
                          </span>
                          <span className="pdf-automation__history-item-time">
                            {formatTimestamp(entry.startedAt)}
                          </span>
                        </div>
                      </div>
                      <div className="pdf-automation__history-item-status">
                        <span className={`pdf-automation__history-status ${statusInfo.className}`}>
                          <span className="pdf-automation__history-status-icon">{statusInfo.icon}</span>
                          <span className="pdf-automation__history-status-text">{statusInfo.text}</span>
                        </span>
                        {entry.status === 'completed' && (
                          <span className="pdf-automation__history-item-view">View →</span>
                        )}
                      </div>
                      {entry.status === 'failed' && entry.error && (
                        <div className="pdf-automation__history-item-error">
                          {entry.error}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary Modal (Requirements: 7.3) */}
      {showSummaryModal && selectedEntry && (
        <div className="pdf-automation__modal-overlay" onClick={closeSummaryModal}>
          <div className="pdf-automation__modal" onClick={e => e.stopPropagation()}>
            <div className="pdf-automation__modal-header">
              <h3 className="pdf-automation__modal-title">
                📄 {selectedEntry.filename}
              </h3>
              <button
                type="button"
                className="pdf-automation__modal-close"
                onClick={closeSummaryModal}
              >
                ×
              </button>
            </div>
            <div className="pdf-automation__modal-meta">
              <span>Processed: {formatTimestamp(selectedEntry.startedAt)}</span>
              {selectedEntry.pageCount && <span>Pages: {selectedEntry.pageCount}</span>}
              {selectedEntry.wordCount && <span>Words: {selectedEntry.wordCount}</span>}
            </div>
            <div className="pdf-automation__modal-content">
              <h4>Summary</h4>
              <div className="pdf-automation__modal-summary">
                {selectedEntry.summary || 'No summary available'}
              </div>
            </div>
            <div className="pdf-automation__modal-footer">
              <button
                type="button"
                className="pdf-automation__btn pdf-automation__btn--primary"
                onClick={closeSummaryModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PDFAutomationPanel;
