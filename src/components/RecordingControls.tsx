import React from 'react';
import { useRecording } from '../context/RecordingContext';

interface RecordingControlsProps {
  className?: string;
}

const RecordingControls: React.FC<RecordingControlsProps> = ({ className = '' }) => {
  const { 
    isRecording, 
    currentSession, 
    startRecording, 
    stopRecording 
  } = useRecording();

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {!isRecording ? (
        <button
          onClick={startRecording}
          className="flex items-center gap-2 px-4 py-2 bg-audafact-alert-red text-audafact-text-primary rounded-lg hover:bg-opacity-90 transition-colors shadow-sm"
        >
          <div className="w-3 h-3 bg-current rounded-full"></div>
          Record
        </button>
      ) : (
        <button
          onClick={stopRecording}
          className="flex items-center gap-2 px-4 py-2 bg-audafact-text-secondary text-audafact-bg-primary rounded-lg hover:bg-opacity-90 transition-colors shadow-sm"
        >
          <div className="w-3 h-3 bg-current rounded-full animate-pulse"></div>
          Stop
        </button>
      )}
      
      {isRecording && currentSession && (
        <div className="flex items-center gap-2 text-sm audafact-text-secondary">
          <span>Recording...</span>
          <span className="font-mono">
            {formatDuration(Date.now() - currentSession.startTime)}
          </span>
        </div>
      )}
    </div>
  );
};

export default RecordingControls; 