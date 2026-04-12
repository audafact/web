import React, { useState } from 'react';
import { Save, Check } from 'lucide-react';
import { useRecording } from '../context/RecordingContext';
import { useAccessControl } from '../hooks/useAccessControl';
import { UpgradePrompt } from './UpgradePrompt';
import Tooltip from './Tooltip';
import { useUser } from '../hooks/useUser';
import { showSignupModal } from '../hooks/useSignupModal';

interface RecordingControlsProps {
  className?: string;
  onSave?: () => void;
  audioContext?: AudioContext;
  /** When true (e.g. Studio side panel open), use icon-only primary actions and tighter copy */
  compact?: boolean;
}

const RecordingControls: React.FC<RecordingControlsProps> = ({
  className = '',
  onSave,
  audioContext,
  compact = false,
}) => {
  const {
    isRecordingPerformance,
    currentPerformance,
    startPerformanceRecording,
    stopPerformanceRecording,
    recordEventsEnabled,
    setRecordEventsEnabled,
    recordMixEnabled,
    setRecordMixEnabled,
    isOverdubEnabled,
    playingPerformanceId,
  } = useRecording();
  const { canPerformAction, getUpgradeMessage } = useAccessControl();
  const { tier } = useUser();
  
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

  const compactLbl = compact ? 'sr-only' : '';

  return (
    <div className={`flex flex-wrap items-center gap-x-2 sm:gap-x-4 gap-y-2 min-w-0 ${className}`}>
      {/* Save Button */}
      <Tooltip content="Save current session" position="top" delay={150}>
        <button
          onClick={handleSave}
          disabled={!onSave || isSaving}
          className={`flex items-center justify-center gap-2 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px] ${
            compact ? 'px-2.5 sm:px-3' : 'px-4 py-2'
          } ${
            saveSuccess
              ? 'bg-green-500 text-white'
              : 'bg-audafact-text-secondary text-audafact-bg-primary hover:bg-opacity-90'
          }`}
          aria-label={saveSuccess ? 'Session saved' : isSaving ? 'Saving session' : 'Save current session'}
        >
          {saveSuccess ? (
            <>
              <Check size={compact ? 16 : 12} aria-hidden />
              <span className={compactLbl}>Saved!</span>
            </>
          ) : isSaving ? (
            <>
              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" aria-hidden />
              <span className={compactLbl}>Saving...</span>
            </>
          ) : (
            <>
              <Save size={compact ? 16 : 12} aria-hidden />
              <span className={compactLbl}>Save</span>
            </>
          )}
        </button>
      </Tooltip>

      {/* Record Button and Status */}
        <div className={`flex items-center ${compact ? 'gap-1.5 sm:gap-2' : 'gap-3'}`}>
          {isRecordingPerformance && currentPerformance && (
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm audafact-text-secondary min-w-0">
              <span className={compact ? 'hidden xl:inline max-w-[min(100%,14rem)] truncate' : ''}>
                {currentPerformance.events.length === 0
                  ? 'Waiting for first trigger...'
                  : recordMixEnabled && recordEventsEnabled
                    ? 'Recording mix & events…'
                    : recordMixEnabled
                      ? 'Recording mix…'
                      : 'Recording events…'}
              </span>
              <span className="font-mono shrink-0 tabular-nums">
                {formatDuration(Date.now() - currentPerformance.startTime)}
              </span>
            </div>
          )}

          {!isRecordingPerformance ? (
            <>
            <div className={`flex flex-wrap items-center text-xs audafact-text-secondary ${compact ? 'gap-1.5' : 'gap-3'}`}>
              <label className="inline-flex items-center gap-1 sm:gap-1.5 cursor-pointer select-none" title="Log performance events">
                <input
                  type="checkbox"
                  checked={recordEventsEnabled}
                  onChange={(e) => setRecordEventsEnabled(e.target.checked)}
                  aria-label="Log performance events"
                />
                Log events
              </label>
              <label className="inline-flex items-center gap-1 sm:gap-1.5 cursor-pointer select-none" title="Record master mix">
                <input
                  type="checkbox"
                  checked={recordMixEnabled}
                  onChange={(e) => setRecordMixEnabled(e.target.checked)}
                  aria-label="Record master mix"
                />
                Record mix
              </label>
            </div>
            <Tooltip content="Record performance" position="top" delay={150}>
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

                  startPerformanceRecording(audioContext, {
                    recordEvents: recordEventsEnabled,
                    recordMix: recordMixEnabled,
                    continueOverdub: isOverdubEnabled && !!playingPerformanceId,
                  });
                }}
                className={`flex items-center justify-center gap-2 bg-audafact-alert-red text-audafact-text-primary rounded-lg hover:bg-opacity-90 transition-colors shadow-sm min-h-[40px] ${
                  compact ? 'px-2.5 sm:px-3' : 'px-4 py-2'
                }`}
                aria-label="Record performance"
              >
                <div className="w-3 h-3 bg-current rounded-full shrink-0" aria-hidden />
                <span className={compactLbl}>Record</span>
              </button>
            </Tooltip>
            </>
          ) : (
            <button
              onClick={stopPerformanceRecording}
              className={`flex items-center justify-center gap-2 bg-audafact-text-secondary text-audafact-bg-primary rounded-lg hover:bg-opacity-90 transition-colors shadow-sm min-h-[40px] ${
                compact ? 'px-2.5 sm:px-3' : 'px-4 py-2'
              }`}
              aria-label={
                currentPerformance && currentPerformance.events.length === 0
                  ? 'Ready to record'
                  : 'Stop recording'
              }
            >
              <div
                className={`w-3 h-3 rounded-full shrink-0 ${
                  currentPerformance && currentPerformance.events.length > 0
                    ? 'bg-audafact-alert-red animate-recording-blink'
                    : 'bg-audafact-divider'
                }`}
                aria-hidden
              />
              <span className={compactLbl}>
                {currentPerformance && currentPerformance.events.length === 0
                  ? 'Ready to record...'
                  : 'Stop Recording'}
              </span>
            </button>
          )}
        </div>
        
        {/* Upgrade Prompt Modal */}
        {showUpgradePrompt && (
          <UpgradePrompt
            message={getUpgradeMessage('record')}
            feature="Recording"
            onClose={() => setShowUpgradePrompt(false)}
          />
        )}
    </div>
  );
};

export default RecordingControls; 