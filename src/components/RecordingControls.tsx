import React, { useState } from 'react';
import { Save, Check } from 'lucide-react';
import { useRecording } from '../context/RecordingContext';
import { useAccessControl } from '../hooks/useAccessControl';
import { UpgradePrompt } from './UpgradePrompt';
import { useUserTier } from '../hooks/useUserTier';
import { showSignupModal } from '../hooks/useSignupModal';
import FeatureGate from './FeatureGate';

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
  const { canPerformAction, getUpgradeMessage, canAccessFeature } = useAccessControl();
  const { tier } = useUserTier();
  
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleSave = async () => {
    if (!onSave) return;

    // Check if user is authenticated
    if (!tier || tier.id === 'guest') {
      showSignupModal('save_session');
      return;
    }

    // Check save limits for authenticated users
    const canSave = await canPerformAction('save_session');
    if (!canSave) {
      setShowUpgradePrompt(true);
      return;
    }

    setIsSaving(true);
    
    try {
      await onSave();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`flex items-center justify-between w-full ${className}`}>
      {/* Save Button - Left Side */}
      <button
        onClick={handleSave}
        disabled={!onSave || isSaving}
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
        ) : isSaving ? (
          <>
            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
            Saving...
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
              onClick={async () => {
                // Check if user is authenticated
                if (!tier || tier.id === 'guest') {
                  showSignupModal('record');
                  return;
                }

                // Check record limits for authenticated users
                const canRecord = await canPerformAction('record');
                if (!canRecord) {
                  setShowUpgradePrompt(true);
                  return;
                }
                startPerformanceRecording(audioContext);
              }}
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
        
        {/* Upgrade Prompt Modal */}
        {showUpgradePrompt && (
          <UpgradePrompt
            message={getUpgradeMessage('save_session')}
            feature="Session Save"
            onClose={() => setShowUpgradePrompt(false)}
          />
        )}
    </div>
  );
};

export default RecordingControls; 