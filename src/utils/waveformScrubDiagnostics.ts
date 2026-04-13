/**
 * Runtime diagnostics for WaveSurfer region scrub (loop/cue drag). Enable without rebuilding
 * by appending a query string, or set VITE_WAVEFORM_SCRUB_DIAG in .env for dev.
 *
 * Query: ?waveformScrubDiag=log,noAudio,noParent
 *   - 1, true, yes  — shorthand for log only (not "all")
 *   - log           — on drag start, try play() and log result + HTMLMediaElement snapshot
 *   - noAudio       — skip play() during diag (isolates UI vs HTML audio)
 *   - noParent      — skip Studio drag callbacks during drag (isolates React churn vs WaveSurfer)
 *   - all           — same as log,noAudio,noParent
 *
 * Dev: first region drag logs HTML media element once (no query needed).
 *
 * Examples:
 *   ?waveformScrubDiag=1
 *   ?waveformScrubDiag=log
 *   ?waveformScrubDiag=noAudio
 *   ?waveformScrubDiag=noParent
 */

export type WaveformScrubDiag = {
  enabled: boolean;
  /** Log play() promise + media element state */
  logPlay: boolean;
  /** Do not call play() or scheduleRegionScrub during drag */
  noAudio: boolean;
  /** Do not call onLoopDragStateChange / onCueDragStateChange during drag */
  noParent: boolean;
};

const PREFIX = '[WaveformScrubDiag]';

function parseDiagRaw(raw: string): WaveformScrubDiag {
  const s = raw.trim();
  if (!s) {
    return { enabled: false, logPlay: false, noAudio: false, noParent: false };
  }
  const lower = s.toLowerCase();
  // Single token: log-only (does not enable noAudio/noParent — those were easy to trigger by mistake)
  if (lower === '1' || lower === 'true' || lower === 'yes') {
    return { enabled: true, logPlay: true, noAudio: false, noParent: false };
  }
  const parts = s.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
  const all = parts.includes('all');
  return {
    enabled: true,
    logPlay: all || parts.includes('log'),
    noAudio: all || parts.includes('noaudio'),
    noParent: all || parts.includes('noparent') || parts.includes('no_parent'),
  };
}

/**
 * Read flags from ?waveformScrubDiag=... (wins) or import.meta.env.VITE_WAVEFORM_SCRUB_DIAG.
 * Safe on SSR (returns all false).
 */
export function getWaveformScrubDiag(): WaveformScrubDiag {
  if (typeof window === 'undefined') {
    return { enabled: false, logPlay: false, noAudio: false, noParent: false };
  }
  try {
    const q = new URLSearchParams(window.location.search).get('waveformScrubDiag');
    const env =
      typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_WAVEFORM_SCRUB_DIAG
        ? String(import.meta.env.VITE_WAVEFORM_SCRUB_DIAG)
        : '';
    const raw = (q ?? env).trim();
    return parseDiagRaw(raw);
  } catch {
    return { enabled: false, logPlay: false, noAudio: false, noParent: false };
  }
}

type MediaLike = {
  getMediaElement: () => unknown;
};

function snapshotHtmlMedia(el: unknown, context: string): void {
  if (!el || typeof el !== 'object') {
    console.info(PREFIX, context, 'getMediaElement():', el);
    return;
  }
  const m = el as HTMLMediaElement;
  const snap = {
    tag: (el as { nodeName?: string }).nodeName,
    paused: m.paused,
    muted: m.muted,
    volume: m.volume,
    readyState: m.readyState,
    error: m.error ? { code: m.error.code, message: m.error.message } : null,
    currentTime: typeof m.currentTime === 'number' ? m.currentTime.toFixed(4) : m.currentTime,
    duration: typeof m.duration === 'number' && !Number.isNaN(m.duration) ? m.duration.toFixed(4) : m.duration,
    playbackRate: m.playbackRate,
  };
  console.info(PREFIX, context, snap);
}

/**
 * Attach logging to wavesurfer.play() result. Call with the promise returned by play().
 */
export function logWaveformScrubPlayAttempt(
  wavesurfer: MediaLike,
  context: string,
  playPromise: Promise<void>,
  logPlay: boolean
): void {
  if (!logPlay) return;
  playPromise
    .then(() => {
      requestAnimationFrame(() => {
        snapshotHtmlMedia(wavesurfer.getMediaElement(), `${context}: after play() resolve`);
      });
    })
    .catch((err: unknown) => {
      console.warn(PREFIX, `${context}: play() rejected`, err);
      requestAnimationFrame(() => {
        snapshotHtmlMedia(wavesurfer.getMediaElement(), `${context}: after play() reject`);
      });
    });
}

/** One-shot log when diagnostics are active (e.g. on WaveformDisplay mount). */
export function logWaveformScrubDiagBanner(d: WaveformScrubDiag): void {
  if (!d.enabled) return;
  console.info(
    PREFIX,
    'enabled —',
    [
      d.logPlay && 'log',
      d.noAudio && 'noAudio',
      d.noParent && 'noParent',
    ]
      .filter(Boolean)
      .join(', ') || '(flags parsed but none set; use log, noAudio, noParent, or all)'
  );
}

let devHtmlMediaLoggedOnce = false;

/** Dev-only: log HTML media element once per page (no query flag). Helps debug silent scrub. */
export function logWaveformScrubHtmlMediaOnceDev(wavesurfer: MediaLike, context: string): void {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && !import.meta.env.DEV) return;
  } catch {
    return;
  }
  if (devHtmlMediaLoggedOnce) return;
  devHtmlMediaLoggedOnce = true;
  queueMicrotask(() => {
    snapshotHtmlMedia(wavesurfer.getMediaElement(), `${context} (dev once)`);
  });
}
