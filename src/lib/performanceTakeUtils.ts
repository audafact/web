import type { PerformanceEvent } from '../types/performanceEvents';
import { DEFAULT_TAKE_ID, getEventTakeId } from '../types/performanceEvents';

/** New take id for a lane (in-memory only until events are saved). */
export function generateTakeId(): string {
  return `tk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Among takes that have events on this lane, pick the "latest" take:
 * the take whose first event has the greatest timestamp (newest-started take).
 */
export function inferLatestTakeIdForTrack(events: PerformanceEvent[], trackId: string): string {
  const lane = events.filter((e) => e.trackId === trackId);
  if (lane.length === 0) return DEFAULT_TAKE_ID;

  const byTake = new Map<string, PerformanceEvent[]>();
  for (const e of lane) {
    const tid = getEventTakeId(e);
    const arr = byTake.get(tid) ?? [];
    arr.push(e);
    byTake.set(tid, arr);
  }

  let best = DEFAULT_TAKE_ID;
  let bestFirst = -Infinity;
  for (const [tid, list] of byTake) {
    const first = Math.min(...list.map((x) => x.timestamp));
    if (first > bestFirst) {
      bestFirst = first;
      best = tid;
    } else if (first === bestFirst && tid.localeCompare(best) > 0) {
      best = tid;
    }
  }
  return best;
}

export interface FilterPlaybackEventsArgs {
  events: PerformanceEvent[];
  /** When set, only that lane */
  trackIdFilter: string | null;
  /** Explicit playback take per lane; missing keys fall back to inferLatestTakeIdForTrack */
  playbackTakeByTrack?: Record<string, string | undefined>;
}

/**
 * Filter events for one shared timeline pass: per-lane take selection + optional single-track lane play.
 */
export function filterEventsForPlaybackPass(args: FilterPlaybackEventsArgs): PerformanceEvent[] {
  const { events, trackIdFilter, playbackTakeByTrack } = args;
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

  const trackIdsInPerf = new Set(sorted.map((e) => e.trackId));
  const resolvedTake = new Map<string, string>();
  for (const tid of trackIdsInPerf) {
    const explicit = playbackTakeByTrack?.[tid];
    resolvedTake.set(
      tid,
      explicit !== undefined && explicit !== ''
        ? explicit
        : inferLatestTakeIdForTrack(sorted, tid)
    );
  }

  return sorted.filter((e) => {
    if (trackIdFilter != null && trackIdFilter !== '' && e.trackId !== trackIdFilter) {
      return false;
    }
    const want = resolvedTake.get(e.trackId) ?? DEFAULT_TAKE_ID;
    return getEventTakeId(e) === want;
  });
}
