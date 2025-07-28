import React from 'react';
import { Save, Check } from 'lucide-react';
import { useRecording } from '../context/RecordingContext';

interface RecordingControlsProps {
  className?: string;
  onSave?: () => void;
  audioContext?: AudioContext;
}

const RecordingControls: React.FC<RecordingControlsProps> = ({ className = '', onSave, audioContext }) => {
  const { 
    isRecordingPerformance, 
    currentPerformance, 
    startPerformanceRecording, 
    stopPerformanceRecording
  } = useRecording();
  
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleSave = () => {
    if (onSave) {
      onSave();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  return (
    <div className={`flex items-center justify-between w-full ${className}`}>
      {/* Save Button - Left Side */}
      <button
        onClick={handleSave}
        disabled={!onSave}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
          saveSuccess 
            ? 'bg-green-500 text-white' 
            : 'bg-audafact-text-secondary text-audafact-bg-primary hover:bg-opacity-90'
        }`}
      >
        {saveSuccess ? (
          <>
            <Check size={12} />
            Saved!
          </>
        ) : (
          <>
            <Save size={12} />
            Save
          </>
        )}
      </button>

              {/* Record Button and Status - Right Side */}
        <div className="flex items-center gap-3">
          {isRecordingPerformance && currentPerformance && (
            <div className="flex items-center gap-2 text-sm audafact-text-secondary">
              <span>Recording Performance & Audio...</span>
              <span className="font-mono">
                {formatDuration(Date.now() - currentPerformance.startTime)}
              </span>
            </div>
          )}

          {!isRecordingPerformance ? (
            <button
              onClick={() => startPerformanceRecording(audioContext)}
              className="flex items-center gap-2 px-4 py-2 bg-audafact-alert-red text-audafact-text-primary rounded-lg hover:bg-opacity-90 transition-colors shadow-sm"
            >
              <div className="w-3 h-3 bg-current rounded-full"></div>
              Record
            </button>
          ) : (
            <button
              onClick={stopPerformanceRecording}
              className="flex items-center gap-2 px-4 py-2 bg-audafact-text-secondary text-audafact-bg-primary rounded-lg hover:bg-opacity-90 transition-colors shadow-sm"
            >
              <div className="w-3 h-3 bg-current rounded-full animate-pulse"></div>
              Stop Recording
            </button>
          )}
        </div>
    </div>
  );
};

export default RecordingControls; 