import React, { useState, useEffect } from 'react';
import './ProfileModal.css';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  onSave: (name: string) => void;
}

/**
 * ProfileModal Component - User Profile Settings
 * Allows users to view and edit their profile information
 */
export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  userName,
  onSave,
}) => {
  const [name, setName] = useState(userName);
  const [isSaving, setIsSaving] = useState(false);

  // Sync name with prop when modal opens
  useEffect(() => {
    if (isOpen) {
      setName(userName);
    }
  }, [isOpen, userName]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    
    setIsSaving(true);
    try {
      onSave(name.trim());
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div 
      className="profile-modal__backdrop" 
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div 
        className="profile-modal" 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="profile-title"
      >
        <div className="profile-modal__header">
          <h2 id="profile-title" className="profile-modal__title">Profile</h2>
          <button
            className="profile-modal__close-btn"
            onClick={onClose}
            aria-label="Close profile"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="profile-modal__content">
          <div className="profile-modal__avatar-section">
            <div className="profile-modal__avatar">
              {getInitials(name || 'User')}
            </div>
            <p className="profile-modal__avatar-hint">
              Your initials are generated from your name
            </p>
          </div>

          <div className="profile-modal__form">
            <div className="profile-modal__form-group">
              <label htmlFor="profile-name" className="profile-modal__label">
                Display Name
              </label>
              <input
                id="profile-name"
                type="text"
                className="profile-modal__input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                autoFocus
              />
              <p className="profile-modal__hint">
                This name will be shown in the sidebar and greetings.
              </p>
            </div>
          </div>
        </div>

        <div className="profile-modal__footer">
          <button
            className="profile-modal__btn profile-modal__btn--cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="profile-modal__btn profile-modal__btn--save"
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
