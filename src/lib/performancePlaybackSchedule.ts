import type { PerformanceEvent } from '../types/performanceEvents';

export interface SchedulePlaybackOptions {
  events: PerformanceEvent[];
  /** Engaged tracks receive events; empty set means none */
  engagedTrackIds: Set<string>;
  /** If set, only dispatch events for this track */
  trackIdFilter?: string | null;
  loop: boolean;
  /** When set with loop, wrap event timestamps for dispatch timing */
  cycleLengthMs?: number;
  /** Wall duration of this pass (typically performance.duration or cycleLengthMs when looping) */
  passDurationMs: number;
  /** Prefer AudioContext clock for anchor; falls back to performance.now() */
  audioContext?: AudioContext | null;
  onFire: (event: PerformanceEvent) => void;
  onPassComplete: () => void;
  abortToken: { cancelled: boolean };
}

/**
 * Schedules performance events relative to a single anchor time.
 * Uses wall-clock delays aligned to AudioContext snapshot when provided.
 */
export function schedulePerformanceEventsPass(
  opts: SchedulePlaybackOptions
): { cancelScheduled: () => void } {
  const {
    events,
    engagedTrackIds,
    trackIdFilter,
    loop,
    cycleLengthMs,
    passDurationMs,
    audioContext,
    onFire,
    onPassComplete,
    abortToken,
  } = opts;

  const filtered = events
    .filter((e) => {
      if (!engagedTrackIds.has(e.trackId)) return false;
      if (trackIdFilter != null && trackIdFilter !== '' && e.trackId !== trackIdFilter) return false;
      return true;
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  const timeouts: number[] = [];

  const anchorWallMs = performance.now();
  /** Single snapshot so all delays align to one t0 */
  const acSnapshot = audioContext != null ? audioContext.currentTime : null;

  const delayForEvent = (event: PerformanceEvent): number => {
    let ms = event.timestamp;
    if (loop && cycleLengthMs != null && cycleLengthMs > 0) {
      ms = ms % cycleLengthMs;
    }
    if (acSnapshot != null && audioContext != null) {
      const targetSec = acSnapshot + ms / 1000;
      return Math.max(0, (targetSec - acSnapshot) * 1000);
    }
    return Math.max(0, ms - (performance.now() - anchorWallMs));
  };

  filtered.forEach((event) => {
    const id = window.setTimeout(() => {
      if (abortToken.cancelled) return;
      onFire(event);
    }, delayForEvent(event));
    timeouts.push(id);
  });

  const effectiveDuration =
    loop && cycleLengthMs != null && cycleLengthMs > 0
      ? cycleLengthMs
      : Math.max(passDurationMs, 1);

  const completeId = window.setTimeout(() => {
    if (abortToken.cancelled) return;
    onPassComplete();
  }, effectiveDuration + 20);
  timeouts.push(completeId);

  return {
    cancelScheduled: () => {
      timeouts.forEach((id) => window.clearTimeout(id));
    },
  };
}
