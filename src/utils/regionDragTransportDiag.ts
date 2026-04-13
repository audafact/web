/**
 * Opt-in diagnostics for region-drag → Studio state → TrackControls transport pause.
 *
 * Append to the URL: ?regionDragTransportDiag=1
 *
 * Logs (console):
 * - WaveformDisplay: first region `update` (drag begin), whether scrub diag skipped parent (noParent)
 * - Studio: handleLoopDragStateChange / handleCueDragStateChange invocations
 * - TrackControls: region-drag effect → stop transport vs resume vs noop
 */

export function isRegionDragTransportDiagEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('regionDragTransportDiag') === '1';
  } catch {
    return false;
  }
}

const PREFIX = '[RegionDragTransportDiag]';

export function logRegionDragTransport(message: string, data?: Record<string, unknown>): void {
  if (!isRegionDragTransportDiagEnabled()) return;
  if (data && Object.keys(data).length > 0) {
    console.info(PREFIX, message, data);
  } else {
    console.info(PREFIX, message);
  }
}
