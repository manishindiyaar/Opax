import React, { useState } from 'react';
import './WelcomeModal.css';

interface WelcomeModalProps {
  isOpen: boolean;
  onSave: (name: string) => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onSave }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter your name');
      return;
    }
    if (trimmed.length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    onSave(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const getInitials = (n: string) => {
    const parts = n.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  };

  return (
    <div className="welcome-modal__backdrop">
      <div className="welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <div className="welcome-modal__glow" />

        <div className="welcome-modal__logo">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="url(#wg)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <defs>
              <linearGradient id="wg" x1="0" y1="0" x2="24" y2="24">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
            <path d="M12 22v-5" />
            <path d="M9 8V2" />
            <path d="M15 8V2" />
            <path d="M18 8H6a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2z" />
          </svg>
        </div>

        <h1 id="welcome-title" className="welcome-modal__title">Welcome to Opax</h1>
        <p className="welcome-modal__subtitle">Your clinical AI assistant. Let's get you set up.</p>

        <div className="welcome-modal__avatar-preview">
          <div className="welcome-modal__avatar">
            {name.trim() ? getInitials(name) : '?'}
          </div>
        </div>

        <div className="welcome-modal__form">
          <label htmlFor="welcome-name" className="welcome-modal__label">What should we call you?</label>
          <input
            id="welcome-name"
            type="text"
            className={`welcome-modal__input ${error ? 'welcome-modal__input--error' : ''}`}
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            placeholder="Enter your name"
            autoFocus
            maxLength={50}
          />
          {error && <p className="welcome-modal__error">{error}</p>}
        </div>

        <button
          className="welcome-modal__btn"
          onClick={handleSubmit}
          disabled={!name.trim()}
        >
          Get Started
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default WelcomeModal;
