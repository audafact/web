import React, { useMemo } from 'react';
import { useRecording } from '../context/RecordingContext';

interface LaneTransportControlsProps {
  trackId: string;
  disabled?: boolean;
}

/**
 * Per-track lane transport: arm, take stack, new take, lane play/stop, erase take/lane.
 * Sits in the Studio track header (desktop right column; mobile gets its own row).
 */
const LaneTransportControls: React.FC<LaneTransportControlsProps> = ({ trackId, disabled = false }) => {
  const {
    isRecordingPerformance,
    currentPerformance,
    unarmedRecordingTrackIds,
    toggleRecordingArmForTrack,
    laneTakeStacks,
    activeRecordingTakeByTrack,
    playbackTakeByTrack,
    newTakeForTrack,
    selectRecordingTakeForTrack,
    selectPlaybackTakeForTrack,
    performances,
    startLanePlayback,
    stopPerformancePlayback,
    playingPerformanceId,
    engagedTrackIds,
    eraseCurrentTakeForTrack,
    eraseWholeLaneForTrack,
  } = useRecording();

  const perfForLane = useMemo(() => {
    return performances.find((p) => p.events.some((e) => e.trackId === trackId)) ?? null;
  }, [performances, trackId]);

  const takeList = laneTakeStacks[trackId] ?? [];
  const recTake = activeRecordingTakeByTrack[trackId];
  const playTake = playbackTakeByTrack[trackId];
  const combined = recTake || playTake || takeList[0] || '';

  const isArmed = !unarmedRecordingTrackIds.includes(trackId);

  const isLaneLoopPlaying = !!(
    perfForLane &&
    playingPerformanceId === perfForLane.id &&
    engagedTrackIds.length === 1 &&
    engagedTrackIds[0] === trackId
  );

  const handleTakeSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    selectRecordingTakeForTrack(trackId, v);
    selectPlaybackTakeForTrack(trackId, v);
  };

  const selectValue = takeList.includes(combined) ? combined : takeList[0] ?? '';

  return (
    <div className="flex flex-wrap items-center gap-1.5 justify-end shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => toggleRecordingArmForTrack(trackId)}
        className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
          isArmed
            ? 'border-audafact-accent-cyan text-audafact-accent-cyan'
            : 'border-audafact-divider audafact-text-secondary'
        }`}
        title={isArmed ? 'Lane armed for recording' : 'Lane muted for new events'}
      >
        {isArmed ? 'Arm' : 'Off'}
      </button>
      <select
        className="text-[10px] bg-audafact-surface-2 border border-audafact-divider rounded px-1 py-0.5 max-w-[100px] audafact-text-primary"
        value={selectValue}
        onChange={handleTakeSelect}
        disabled={disabled || takeList.length === 0}
        title="Active take (record + playback)"
      >
        {takeList.map((t, i) => (
          <option key={t} value={t}>
            T{i + 1}
          </option>
        ))}
      </select>
      {isRecordingPerformance && (
        <button
          type="button"
          disabled={disabled}
          className="px-1.5 py-0.5 rounded text-[10px] border border-audafact-divider audafact-text-secondary hover:bg-audafact-surface-2"
          onClick={() => newTakeForTrack(trackId)}
          title="New take for this lane"
        >
          +Take
        </button>
      )}
      {perfForLane && (
        <button
          type="button"
          disabled={disabled}
          className="px-1.5 py-0.5 rounded text-[10px] border border-audafact-divider audafact-text-secondary hover:bg-audafact-surface-2"
          onClick={async () => {
            if (isLaneLoopPlaying) {
              stopPerformancePlayback();
              return;
            }
            await startLanePlayback(perfForLane.id, trackId, { loop: true });
          }}
          title="Loop replay this lane only"
        >
          {isLaneLoopPlaying ? 'Stop' : 'Play'}
        </button>
      )}
      {isRecordingPerformance && currentPerformance && (
        <>
          <button
            type="button"
            disabled={disabled}
            className="px-1.5 py-0.5 rounded text-[10px] border border-audafact-divider audafact-text-secondary hover:bg-audafact-surface-2"
            onClick={() => {
              if (
                window.confirm(
                  'Erase all events in the current take for this track? This cannot be undone before save.'
                )
              ) {
                eraseCurrentTakeForTrack(trackId);
              }
            }}
            title="Erase current take"
          >
            Clr take
          </button>
          <button
            type="button"
            disabled={disabled}
            className="px-1.5 py-0.5 rounded text-[10px] border border-audafact-alert-red/40 text-audafact-alert-red hover:bg-audafact-surface-2"
            onClick={() => {
              if (
                window.confirm(
                  'Remove all recorded events for this track on all takes? This cannot be undone before save.'
                )
              ) {
                eraseWholeLaneForTrack(trackId);
              }
            }}
            title="Erase whole lane (all takes)"
          >
            Clr lane
          </button>
        </>
      )}
    </div>
  );
};

export default LaneTransportControls;
