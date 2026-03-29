import React, { useState, useRef, useEffect } from 'react';
import Tooltip from './Tooltip';

interface HelpButtonProps {
  onStartTutorial: () => void;
  onShowHelp: () => void;
  /** Opens the in-app feedback form (Request a feature / Report a problem). */
  onShowFeedback?: () => void;
  className?: string;
  hideTutorial?: boolean;
}

const HelpButton: React.FC<HelpButtonProps> = ({
  onStartTutorial,
  onShowHelp,
  onShowFeedback,
  className = '',
  hideTutorial = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const el = rootRef.current;
      if (el && !el.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

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

  const handleShowFeedback = () => {
    setIsOpen(false);
    onShowFeedback?.();
  };

  return (
    <div
      ref={rootRef}
      className={`fixed bottom-6 right-6 z-[70] flex flex-col items-end ${className}`}
    >
      {/* Help Menu */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 bg-audafact-surface-1 border border-audafact-divider rounded-lg shadow-xl p-2 min-w-[15rem] max-w-[calc(100vw-2rem)]">
          {!hideTutorial && (
            <button
              onClick={handleStartTutorial}
              className="w-full text-left px-3 py-2 text-sm text-audafact-text-primary hover:bg-audafact-surface-2 rounded transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Interactive tour
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
          {onShowFeedback ? (
            <button
              type="button"
              onClick={handleShowFeedback}
              className="w-full text-left px-3 py-2 text-sm text-audafact-text-primary hover:bg-audafact-surface-2 rounded transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              Request a Feature/Report a Problem
            </button>
          ) : null}
          <div className="border-t border-audafact-divider my-1"></div>
          <div className="px-3 py-1 text-xs text-audafact-text-secondary">
            Press ? for keyboard shortcuts
          </div>
        </div>
      )}

      {/* Main Help Button */}
      <Tooltip content="Help & Tutorial" position="top" delay={150} zIndex={1100}>
        <button
          type="button"
          onClick={handleToggle}
          className="bg-audafact-accent-cyan text-audafact-bg-primary w-12 h-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center hover:scale-105"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </Tooltip>
    </div>
  );
};

export default HelpButton; 