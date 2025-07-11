interface ModeSelectorProps {
  mode: 'loop' | 'cue';
  onModeChange: (mode: 'loop' | 'cue') => void;
}

const ModeSelector = ({ mode, onModeChange }: ModeSelectorProps) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <div className="flex space-x-4">
        <button
          onClick={() => onModeChange('loop')}
          className={`flex-1 py-2 px-4 rounded-md ${
            mode === 'loop'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Loop Mode
        </button>
        <button
          onClick={() => onModeChange('cue')}
          className={`flex-1 py-2 px-4 rounded-md ${
            mode === 'cue'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Cue Mode
        </button>
      </div>
    </div>
  );
};

export default ModeSelector; 