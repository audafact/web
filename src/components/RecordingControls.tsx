import React, { useState } from 'react';
import { Save, Check } from 'lucide-react';
import { useRecording } from '../context/RecordingContext';
import { useAudioContext } from '../context/AudioContext';
import { useAccessControl } from '../hooks/useAccessControl';
import { UpgradePrompt } from './UpgradePrompt';
import Tooltip from './Tooltip';
import { useUser } from '../hooks/useUser';
import { showSignupModal } from '../hooks/useSignupModal';
import { exposeAdvancedPerformanceUi } from '../config/featureFlags';

interface RecordingControlsProps {
  className?: string;
  onSave?: () => void;
  audioContext?: AudioContext;
  /**
   * Studio side panel open — with the rest of Studio chrome, labels stay hidden until `xl`
   * (matches New session / Restore prior). When false, labels show from `md` up.
   */
  isSidePanelOpen?: boolean;
}

const RecordingControls: React.FC<RecordingControlsProps> = ({
  className = '',
  onSave,
  audioContext,
  isSidePanelOpen = false,
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
    mixRecordingHasPlayback,
  } = useRecording();
  const { audioContext: audioContextFromProvider, initializeAudio } = useAudioContext();
  const { canPerformAction, getUpgradeMessage } = useAccessControl();
  const { tier } = useUser();
  
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const waitingForMixPlayback =
    !!isRecordingPerformance && recordMixEnabled && !mixRecordingHasPlayback;
  const isActivelyCapturing =
    (recordMixEnabled && mixRecordingHasPlayback) ||
    (exposeAdvancedPerformanceUi &&
      recordEventsEnabled &&
      !!currentPerformance &&
      currentPerformance.events.length > 0);

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

  /** Same breakpoints as New session / Restore prior in Studio */
  const primaryLabelClass = isSidePanelOpen ? 'hidden xl:inline' : 'hidden md:inline';

  const primaryBtnPad =
    'min-h-[40px] min-w-[40px] sm:min-w-0 px-2 sm:px-4 py-2 justify-center gap-1.5 sm:gap-2';

  return (
    <div className={`flex flex-wrap items-center gap-x-1.5 sm:gap-x-3 gap-y-2 min-w-0 ${className}`}>
      {/* Save Button */}
      <Tooltip content="Save current session" position="top" delay={150}>
        <button
          onClick={handleSave}
          disabled={!onSave || isSaving}
          className={`inline-flex items-center rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${primaryBtnPad} ${
            saveSuccess
              ? 'bg-green-500 text-white'
              : 'bg-audafact-text-secondary text-audafact-bg-primary hover:bg-opacity-90'
          }`}
          aria-label={saveSuccess ? 'Session saved' : isSaving ? 'Saving session' : 'Save current session'}
        >
          {saveSuccess ? (
            <>
              <Check className="h-4 w-4 shrink-0" aria-hidden />
              <span className={primaryLabelClass}>Saved!</span>
            </>
          ) : isSaving ? (
            <>
              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" aria-hidden />
              <span className={primaryLabelClass}>Saving...</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4 shrink-0" aria-hidden />
              <span className={primaryLabelClass}>Save</span>
            </>
          )}
        </button>
      </Tooltip>

      {/* Record Button and Status */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {isRecordingPerformance && currentPerformance && (
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm audafact-text-secondary min-w-0">
              <span
                className={`max-w-[min(100%,14rem)] truncate ${primaryLabelClass}`}
              >
                {!exposeAdvancedPerformanceUi
                  ? waitingForMixPlayback
                    ? 'Waiting for playback…'
                    : 'Recording mix…'
                  : waitingForMixPlayback
                    ? 'Waiting for playback…'
                    : exposeAdvancedPerformanceUi &&
                        recordEventsEnabled &&
                        currentPerformance.events.length === 0 &&
                        !(recordMixEnabled && mixRecordingHasPlayback)
                      ? 'Waiting for first trigger…'
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
            {exposeAdvancedPerformanceUi && (
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 text-xs audafact-text-secondary">
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
            )}
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

                  const recordMix = exposeAdvancedPerformanceUi ? recordMixEnabled : true;
                  const recordEvents = exposeAdvancedPerformanceUi ? recordEventsEnabled : false;

                  let ctx: AudioContext | undefined =
                    audioContext ?? audioContextFromProvider ?? undefined;
                  if (recordMix && !ctx) {
                    try {
                      ctx = await initializeAudio();
                    } catch (e) {
                      console.error('Failed to initialize audio for recording:', e);
                      alert(
                        'Could not start audio for recording. Try playing a track or tapping the waveform first.'
                      );
                      return;
                    }
                  }

                  startPerformanceRecording(ctx, {
                    recordEvents,
                    recordMix,
                    continueOverdub:
                      exposeAdvancedPerformanceUi && isOverdubEnabled && !!playingPerformanceId,
                  });
                }}
                className={`inline-flex items-center bg-audafact-alert-red text-audafact-text-primary rounded-lg hover:bg-opacity-90 transition-colors shadow-sm ${primaryBtnPad}`}
                aria-label="Record performance"
              >
                <div className="w-3 h-3 bg-current rounded-full shrink-0" aria-hidden />
                <span className={primaryLabelClass}>Record</span>
              </button>
            </Tooltip>
            </>
          ) : (
            <button
              onClick={stopPerformanceRecording}
              className={`inline-flex items-center bg-audafact-text-secondary text-audafact-bg-primary rounded-lg hover:bg-opacity-90 transition-colors shadow-sm ${primaryBtnPad}`}
              aria-label={isActivelyCapturing ? 'Stop recording' : 'Ready to record'}
            >
              <div
                className={`w-3 h-3 rounded-full shrink-0 ${
                  currentPerformance && isActivelyCapturing
                    ? 'bg-audafact-alert-red animate-recording-blink'
                    : 'bg-audafact-divider'
                }`}
                aria-hidden
              />
              <span className={primaryLabelClass}>
                {isActivelyCapturing ? 'Stop Recording' : 'Ready to record...'}
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