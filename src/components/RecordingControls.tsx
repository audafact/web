import React, { useState, useMemo } from 'react';
import { Save, Check } from 'lucide-react';
import { useRecording } from '../context/RecordingContext';
import { useAccessControl } from '../hooks/useAccessControl';
import { UpgradePrompt } from './UpgradePrompt';
import { useUser } from '../hooks/useUser';
import { showSignupModal } from '../hooks/useSignupModal';

interface RecordingControlsProps {
  className?: string;
  onSave?: () => void;
  audioContext?: AudioContext;
  /** Current Studio track ids — used for global arm / mute all lanes */
  studioTrackIds?: string[];
}

const RecordingControls: React.FC<RecordingControlsProps> = ({
  className = '',
  onSave,
  audioContext,
  studioTrackIds = [],
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
    performances,
    startPerformancePlayback,
    stopPerformancePlayback,
    armAllRecordingLanes,
    disarmAllRecordingLanes,
    isPerformanceLoopEnabled,
    setPerformanceLoopEnabled,
  } = useRecording();

  const perfForGlobal = useMemo(
    () => performances.find((p) => p.events.length > 0) ?? null,
    [performances]
  );

  const isReplayPlaying = !!(perfForGlobal && playingPerformanceId === perfForGlobal.id);
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

  return (
    <div className={`flex flex-wrap items-center gap-x-6 gap-y-2 w-full ${className}`}>
      {/* Save Button */}
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

      {/* Record Button and Status */}
        <div className="flex items-center gap-3">
          {isRecordingPerformance && currentPerformance && (
            <div className="flex items-center gap-2 text-sm audafact-text-secondary">
              <span>
                {currentPerformance.events.length === 0
                  ? 'Waiting for first trigger...'
                  : recordMixEnabled && recordEventsEnabled
                    ? 'Recording mix & events…'
                    : recordMixEnabled
                      ? 'Recording mix…'
                      : 'Recording events…'}
              </span>
              <span className="font-mono">
                {formatDuration(Date.now() - currentPerformance.startTime)}
              </span>
            </div>
          )}

          {!isRecordingPerformance ? (
            <>
            <div className="flex flex-wrap items-center gap-3 text-xs audafact-text-secondary">
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={recordEventsEnabled}
                  onChange={(e) => setRecordEventsEnabled(e.target.checked)}
                />
                Log events
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={recordMixEnabled}
                  onChange={(e) => setRecordMixEnabled(e.target.checked)}
                />
                Record mix
              </label>
            </div>
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
              className="flex items-center gap-2 px-4 py-2 bg-audafact-alert-red text-audafact-text-primary rounded-lg hover:bg-opacity-90 transition-colors shadow-sm"
            >
              <div className="w-3 h-3 bg-current rounded-full"></div>
              Record
            </button>
            </>
          ) : (
            <button
              onClick={stopPerformanceRecording}
              className="flex items-center gap-2 px-4 py-2 bg-audafact-text-secondary text-audafact-bg-primary rounded-lg hover:bg-opacity-90 transition-colors shadow-sm"
            >
              <div
                className={`w-3 h-3 rounded-full ${
                  currentPerformance && currentPerformance.events.length > 0
                    ? 'bg-audafact-alert-red animate-recording-blink'
                    : 'bg-audafact-divider'
                }`}
              />
              {currentPerformance && currentPerformance.events.length === 0
                ? 'Ready to record...'
                : 'Stop Recording'}
            </button>
          )}
        </div>

      {studioTrackIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs border-l border-audafact-divider pl-4 audafact-text-secondary">
          <span className="uppercase tracking-wide shrink-0">Session</span>
          <button
            type="button"
            className="px-2 py-1 rounded border border-audafact-divider hover:bg-audafact-surface-2"
            onClick={() => armAllRecordingLanes(studioTrackIds)}
            title="Arm all lanes for event logging"
          >
            Arm all
          </button>
          <button
            type="button"
            className="px-2 py-1 rounded border border-audafact-divider hover:bg-audafact-surface-2"
            onClick={() => disarmAllRecordingLanes(studioTrackIds)}
            title="Mute all lanes for new events"
          >
            Mute all
          </button>
          {perfForGlobal && (
            <>
              <label className="inline-flex items-center gap-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isPerformanceLoopEnabled}
                  onChange={(e) => setPerformanceLoopEnabled(e.target.checked)}
                />
                Loop replay
              </label>
              <button
                type="button"
                className="px-2 py-1 rounded border border-audafact-accent-cyan text-audafact-accent-cyan hover:bg-audafact-surface-2"
                onClick={async () => {
                  if (isReplayPlaying) {
                    stopPerformancePlayback();
                    return;
                  }
                  await startPerformancePlayback(perfForGlobal.id, {
                    loop: isPerformanceLoopEnabled,
                    audioContext: audioContext ?? null,
                  });
                }}
              >
                {isReplayPlaying ? 'Stop replay' : 'Play all'}
              </button>
            </>
          )}
        </div>
      )}
        
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