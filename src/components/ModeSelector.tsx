interface ModeSelectorProps {
  mode: 'loop' | 'cue';
  onModeChange: (mode: 'loop' | 'cue') => void;
}

const ModeSelector = ({ mode, onModeChange }: ModeSelectorProps) => {
  return (
    <div className="audafact-card p-6">
      <div className="flex space-x-4">
        <button
          onClick={() => onModeChange('loop')}
          className={`flex-1 py-2 px-4 rounded-md transition-colors duration-200 ${
            mode === 'loop'
              ? 'bg-audafact-accent-cyan text-audafact-bg-primary'
              : 'bg-audafact-surface-2 text-audafact-text-secondary hover:bg-audafact-divider hover:text-audafact-text-primary'
          }`}
        >
          loop xtractor
        </button>
        <button
          onClick={() => onModeChange('cue')}
          className={`flex-1 py-2 px-4 rounded-md transition-colors duration-200 ${
            mode === 'cue'
              ? 'bg-audafact-alert-red text-audafact-text-primary'
              : 'bg-audafact-surface-2 text-audafact-text-secondary hover:bg-audafact-divider hover:text-audafact-text-primary'
          }`}
        >
          xcuevator
        </button>
      </div>
    </div>
  );
};

export default ModeSelector; 