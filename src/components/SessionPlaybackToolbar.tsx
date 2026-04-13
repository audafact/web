import React, { useMemo } from 'react';
import { Mic, MicOff, Repeat, Play, Square } from 'lucide-react';
import { useRecording } from '../context/RecordingContext';
import Tooltip from './Tooltip';

interface SessionPlaybackToolbarProps {
  studioTrackIds: string[];
  audioContext?: AudioContext;
  className?: string;
  /** When true (e.g. Studio side panel open), use collapsed short labels (… All) */
  compact?: boolean;
}

/**
 * Global session controls: arm/disarm all lanes (single toggle), loop replay, play all.
 * Play All / Loop apply only when a stored performance has events for **current Studio track ids**
 * (not merely any performance in history — avoids enabled Play after a fresh session load).
 */
const SessionPlaybackToolbar: React.FC<SessionPlaybackToolbarProps> = ({
  studioTrackIds,
  audioContext,
  className = '',
  compact = false,
}) => {
  const {
    performances,
    startPerformancePlayback,
    stopPerformancePlayback,
    armAllRecordingLanes,
    disarmAllRecordingLanes,
    unarmedRecordingTrackIds,
    isPerformanceLoopEnabled,
    setPerformanceLoopEnabled,
    playingPerformanceId,
  } = useRecording();

  /** Only performances that include events for at least one current Studio track (excludes unrelated history). */
  const perfForGlobal = useMemo(() => {
    if (studioTrackIds.length === 0) return null;
    return (
      performances.find(
        (p) =>
          p.events.length > 0 &&
          p.events.some((e) => studioTrackIds.includes(e.trackId))
      ) ?? null
    );
  }, [performances, studioTrackIds]);

  const isReplayPlaying = !!(perfForGlobal && playingPerformanceId === perfForGlobal.id);

  /** True if every studio track is armed for recording (not in unarmed set) */
  const allStudioTracksArmed = useMemo(() => {
    if (studioTrackIds.length === 0) return true;
    return studioTrackIds.every((id) => !unarmedRecordingTrackIds.includes(id));
  }, [studioTrackIds, unarmedRecordingTrackIds]);

  if (studioTrackIds.length === 0) return null;

  /** Collapsed: side panel or narrow viewport — short labels ending in “All” where applicable */
  const collapsedLbl = compact ? 'inline' : 'inline lg:hidden';
  /** Expanded: full wording on large screens when side panel closed */
  const expandedLbl = compact ? 'hidden' : 'hidden lg:inline';

  return (
    <div
      className={`flex flex-wrap items-center justify-end gap-1 sm:gap-1.5 text-xs audafact-text-secondary min-w-0 ${className}`}
      role="toolbar"
      aria-label="Session performance controls"
    >
      <Tooltip
        content={
          allStudioTracksArmed
            ? 'Disarm all lanes — mute new events on every track'
            : 'Arm all lanes — log events on every track'
        }
        position="top"
        delay={150}
      >
        <button
          type="button"
          className="inline-flex items-center justify-center gap-1 px-1.5 sm:px-2 py-1 rounded border border-audafact-divider hover:bg-audafact-surface-2 min-h-[28px] min-w-[28px] sm:min-w-0"
          onClick={() =>
            allStudioTracksArmed
              ? disarmAllRecordingLanes(studioTrackIds)
              : armAllRecordingLanes(studioTrackIds)
          }
          aria-label={allStudioTracksArmed ? 'Disarm all lanes' : 'Arm all lanes'}
        >
          {allStudioTracksArmed ? (
            <MicOff className="w-3.5 h-3.5 shrink-0" aria-hidden />
          ) : (
            <Mic className="w-3.5 h-3.5 shrink-0" aria-hidden />
          )}
          {/* <span className={`${collapsedLbl} text-[10px] sm:text-xs font-medium`}>
            All
          </span> */}
          <span className={expandedLbl}>{allStudioTracksArmed ? 'Disarm all' : 'Arm all'}</span>
        </button>
      </Tooltip>
      <Tooltip
        content={
          perfForGlobal
            ? 'Loop performance replay'
            : 'No performance with events for your current tracks yet'
        }
        position="top"
        delay={150}
      >
        <label
          className={`inline-flex items-center gap-1 select-none rounded border border-transparent px-0.5 py-0.5 min-h-[28px] ${
            perfForGlobal
              ? 'cursor-pointer hover:bg-audafact-surface-2/50'
              : 'cursor-not-allowed opacity-60'
          }`}
        >
          <input
            type="checkbox"
            disabled={!perfForGlobal}
            className="rounded border-audafact-divider disabled:cursor-not-allowed"
            checked={isPerformanceLoopEnabled}
            onChange={(e) => setPerformanceLoopEnabled(e.target.checked)}
            aria-label="Loop replay"
          />
          <Repeat
            className={`w-3.5 h-3.5 shrink-0 ${!perfForGlobal ? 'opacity-60' : ''}`}
            aria-hidden
          />
          {/* <span
            className={`${collapsedLbl} text-[10px] sm:text-xs font-medium ${!perfForGlobal ? 'text-audafact-text-secondary/60' : ''}`}
          >
            All
          </span> */}
          <span className={`${expandedLbl} ${!perfForGlobal ? 'text-audafact-text-secondary/60' : ''}`}>Loop all</span>
        </label>
      </Tooltip>
      <Tooltip
        content={
          !perfForGlobal && !isReplayPlaying
            ? 'No performance with events for your current tracks yet'
            : isReplayPlaying
              ? 'Stop performance replay'
              : 'Replay all engaged lanes'
        }
        position="top"
        delay={150}
      >
        <span className="inline-flex">
          <button
            type="button"
            disabled={!perfForGlobal && !isReplayPlaying}
            className={`inline-flex items-center justify-center gap-1 px-1.5 sm:px-2 py-1 rounded border min-h-[28px] min-w-[28px] sm:min-w-0 ${
              !perfForGlobal && !isReplayPlaying
                ? 'border-audafact-divider/60 text-audafact-text-secondary/40 cursor-not-allowed opacity-60'
                : 'border-audafact-accent-cyan text-audafact-accent-cyan hover:bg-audafact-surface-2'
            }`}
            onClick={async () => {
              if (isReplayPlaying) {
                stopPerformancePlayback();
                return;
              }
              if (!perfForGlobal) return;
              await startPerformancePlayback(perfForGlobal.id, {
                loop: isPerformanceLoopEnabled,
                audioContext: audioContext ?? null,
              });
            }}
            aria-label={isReplayPlaying ? 'Stop replay' : 'Play all'}
          >
            {isReplayPlaying ? (
              <Square className="w-3.5 h-3.5 shrink-0 fill-current" aria-hidden />
            ) : (
              <Play className="w-3.5 h-3.5 shrink-0" aria-hidden />
            )}
            {/* <span className={`${collapsedLbl} text-[10px] sm:text-xs font-medium`}>
              {isReplayPlaying ? 'Stop' : 'Play All'}
            </span> */}
            <span className={expandedLbl}>{isReplayPlaying ? 'Stop' : 'Play all'}</span>
          </button>
        </span>
      </Tooltip>
    </div>
  );
};

export default SessionPlaybackToolbar;
