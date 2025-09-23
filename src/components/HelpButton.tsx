import React, { useState } from 'react';

interface HelpButtonProps {
  onStartTutorial: () => void;
  onShowHelp: () => void;
  className?: string;
  hideTutorial?: boolean;
}

const HelpButton: React.FC<HelpButtonProps> = ({
  onStartTutorial,
  onShowHelp,
  className = '',
  hideTutorial = false
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleStartTutorial = () => {
    setIsOpen(false);
    onStartTutorial();
  };

  const handleShowHelp = () => {
    setIsOpen(false);
    onShowHelp();
  };

  return (
    <div className={`fixed bottom-6 right-6 z-40 ${className}`}>
      {/* Help Menu */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 bg-audafact-surface-1 border border-audafact-divider rounded-lg shadow-xl p-2 min-w-48">
          {!hideTutorial && (
            <button
              onClick={handleStartTutorial}
              className="w-full text-left px-3 py-2 text-sm text-audafact-text-primary hover:bg-audafact-surface-2 rounded transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Start Tutorial
            </button>
          )}
          <button
            onClick={handleShowHelp}
            className="w-full text-left px-3 py-2 text-sm text-audafact-text-primary hover:bg-audafact-surface-2 rounded transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Help & Tips
          </button>
          <div className="border-t border-audafact-divider my-1"></div>
          <div className="px-3 py-1 text-xs text-audafact-text-secondary">
            Press ? for keyboard shortcuts
          </div>
        </div>
      )}

      {/* Main Help Button */}
      <button
        onClick={handleToggle}
        className="bg-audafact-accent-cyan text-audafact-bg-primary w-12 h-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center hover:scale-105"
        title="Help & Tutorial"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
    </div>
  );
};

export default HelpButton; 