import React from 'react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Space', description: 'Play/Pause current track' },
    { key: 'Left/Right Arrow', description: 'Navigate between tracks' },
    { key: '1-0', description: 'Trigger cue points (in Chop mode)' },
    { key: 'Escape', description: 'Close modals and dialogs' },
    { key: '?', description: 'Show this help modal' },
    { key: 'Z', description: 'Zoom in on waveform' },
    { key: 'X', description: 'Zoom out on waveform' },
    { key: 'C', description: 'Reset zoom level' }
  ];

  const tips = [
    'Click anywhere on the waveform to jump to that position',
    'Drag on the waveform to set loop start and end points',
    'Use the side panel to browse and preview tracks from your library',
    'Switch between Preview, Loop, and Chop modes for different workflows',
    'Adjust tempo and time signature to match different tracks',
    'Use filters to shape your sound and create effects',
    'Record your performances to capture your creative process',
    'Save your sessions to return to them later'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-audafact-surface-1 border border-audafact-divider rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-audafact-divider">
          <h2 className="text-xl font-medium text-audafact-text-primary">
            Help & Tips
          </h2>
          <button
            onClick={onClose}
            className="text-audafact-text-secondary hover:text-audafact-text-primary transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Keyboard Shortcuts */}
          <div>
            <h3 className="text-lg font-medium text-audafact-text-primary mb-3">
              Keyboard Shortcuts
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {shortcuts.map((shortcut, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-audafact-surface-2 rounded">
                  <kbd className="px-2 py-1 text-xs font-mono bg-audafact-bg-primary border border-audafact-divider rounded">
                    {shortcut.key}
                  </kbd>
                  <span className="text-sm text-audafact-text-secondary">
                    {shortcut.description}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div>
            <h3 className="text-lg font-medium text-audafact-text-primary mb-3">
              Pro Tips
            </h3>
            <ul className="space-y-2">
              {tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-audafact-text-secondary">
                  <span className="text-audafact-accent-cyan mt-0.5">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* Modes Explanation */}
          <div>
            <h3 className="text-lg font-medium text-audafact-text-primary mb-3">
              Track Modes
            </h3>
            <div className="space-y-3">
              <div className="p-3 bg-audafact-surface-2 rounded">
                <h4 className="font-medium text-audafact-accent-blue mb-1">Preview Mode</h4>
                <p className="text-sm text-audafact-text-secondary">
                  Play the full track from start to finish. Perfect for listening and getting familiar with the material.
                </p>
              </div>
              <div className="p-3 bg-audafact-surface-2 rounded">
                <h4 className="font-medium text-audafact-accent-cyan mb-1">Loop Mode</h4>
                <p className="text-sm text-audafact-text-secondary">
                  Create repeating sections by setting custom start and end points. Great for practicing and building arrangements.
                </p>
              </div>
              <div className="p-3 bg-audafact-surface-2 rounded">
                <h4 className="font-medium text-audafact-alert-red mb-1">Chop Mode</h4>
                <p className="text-sm text-audafact-text-secondary">
                  Trigger specific points in the track using keyboard shortcuts. Ideal for live performances and remixing.
                </p>
              </div>
            </div>
          </div>

          {/* Getting Started */}
          <div>
            <h3 className="text-lg font-medium text-audafact-text-primary mb-3">
              Getting Started
            </h3>
            <div className="space-y-2 text-sm text-audafact-text-secondary">
              <p>
                1. <strong>Load a track</strong> - Use the navigation arrows or browse the library
              </p>
              <p>
                2. <strong>Play and explore</strong> - Try different playback modes and controls
              </p>
              <p>
                3. <strong>Set up loops</strong> - Switch to Loop mode and drag on the waveform
              </p>
              <p>
                4. <strong>Trigger cues</strong> - Use Chop mode and press 1-0 keys
              </p>
              <p>
                5. <strong>Experiment</strong> - Adjust tempo, filters, and effects
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-audafact-divider">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-audafact-surface-2 text-audafact-text-primary rounded hover:bg-audafact-surface-3 transition-colors"
          >
            Close
          </button>
          <div className="text-xs text-audafact-text-secondary">
            Need more help? Contact support at help@audafact.com
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpModal; 