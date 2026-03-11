import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';

type FlowStep = 'mode-choice' | 'how-to-loop' | 'how-to-cue';

interface GetStartedFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (mode: 'loop' | 'cue') => void;
}

const PREFERRED_MODE_KEY = 'audafact_preferred_mode';

export function savePreferredMode(mode: 'loop' | 'cue'): void {
  try {
    localStorage.setItem(PREFERRED_MODE_KEY, mode);
  } catch {
    // ignore
  }
}

export function loadPreferredMode(): 'loop' | 'cue' | null {
  try {
    const v = localStorage.getItem(PREFERRED_MODE_KEY);
    return v === 'loop' || v === 'cue' ? v : null;
  } catch {
    return null;
  }
}

const GetStartedFlowModal: React.FC<GetStartedFlowModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [step, setStep] = useState<FlowStep>('mode-choice');

  useEffect(() => {
    if (isOpen) {
      setStep('mode-choice');
    }
  }, [isOpen]);

  const handleModeChoice = (mode: 'loop' | 'cue') => {
    setStep(mode === 'loop' ? 'how-to-loop' : 'how-to-cue');
  };

  const handleStartDigging = (mode: 'loop' | 'cue') => {
    savePreferredMode(mode);
    onComplete(mode);
    onClose();
  };

  const handleBack = () => {
    setStep('mode-choice');
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg">
      {step === 'mode-choice' && (
        <div className="p-6">
          <p className="text-sm text-audafact-text-secondary mb-6">
            Audafact finds the chops. You play them. Choose how you want to start.
          </p>
          <div className="space-y-4">
            <button
              onClick={() => handleModeChoice('loop')}
              className="w-full text-left p-4 rounded-lg border border-audafact-divider bg-audafact-surface-2 hover:border-audafact-accent-cyan hover:bg-audafact-surface-2/80 transition-colors"
            >
              <h3 className="font-medium text-audafact-heading mb-1">
                Lock in a loop
              </h3>
              <p className="text-sm text-audafact-text-secondary">
                Set start and end on the waveform. Hit space to play.
              </p>
            </button>
            <button
              onClick={() => handleModeChoice('cue')}
              className="w-full text-left p-4 rounded-lg border border-audafact-divider bg-audafact-surface-2 hover:border-audafact-accent-cyan hover:bg-audafact-surface-2/80 transition-colors"
            >
              <h3 className="font-medium text-audafact-heading mb-1">
                Play your samples
              </h3>
              <p className="text-sm text-audafact-text-secondary">
                Instant cue points. Trigger with keys 1–0, drag nodes to reshape.
              </p>
            </button>
          </div>
        </div>
      )}

      {step === 'how-to-loop' && (
        <div className="p-6">
          <h3 className="font-medium text-audafact-heading mb-2">
            Lock in a loop
          </h3>
          <p className="text-sm text-audafact-text-secondary mb-6">
            Drag to set start and end. <strong>Space</strong> to play.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className="px-4 py-2 text-sm text-audafact-text-secondary hover:text-audafact-text-primary transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => handleStartDigging('loop')}
              className="group relative inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-purple text-white font-medium rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              <span className="relative z-10 flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                Start digging
              </span>
            </button>
          </div>
        </div>
      )}

      {step === 'how-to-cue' && (
        <div className="p-6">
          <h3 className="font-medium text-audafact-heading mb-2">
            Play your samples
          </h3>
          <p className="text-sm text-audafact-text-secondary mb-6">
            <strong>1–0</strong> to trigger chops. Drag nodes to reshape them.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className="px-4 py-2 text-sm text-audafact-text-secondary hover:text-audafact-text-primary transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => handleStartDigging('cue')}
              className="group relative inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-purple text-white font-medium rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              <span className="relative z-10 flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                Start digging
              </span>
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default GetStartedFlowModal;
