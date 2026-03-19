/**
 * Rank tracks (library + uploads) by key + tempo compatibility with a session reference track.
 * MVP: client-side only, weighted scores and human-readable adjustment hints.
 *
 * PRD (sample suggestions): Guests may view suggestions; "add suggested sample" → SignupModal
 * ("Add this sample by creating a free account"). Free+ can add.
 */

export interface SuggestionCandidate {
  id: string;
  name: string;
  fileKey: string;
  // For library tracks this will be "wav" | "mp3".
  // For uploads this should be the MIME type (e.g. "audio/mpeg") so Studio can decode reliably.
  type: string;
  size: string;
  bpm?: number;
  key?: string | null;
  /** Optional beat grid; not required for matching today, but useful for future UI. */
  beats?: number[];
}

const KEY_REGEX = /^(C#|Db|D#|Eb|F#|Gb|G#|Ab|A#|Bb|[CDEFGAB])(m|min|maj|major)?$/i;

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

export interface SuggestionReference {
  key?: string;
  bpm?: number;
  /** Exclude this library row id (matches LibraryTrack.id / sourceAssetId) */
  excludeTrackId?: string;
  excludeFileKey?: string;
  /** Reference track playback speed (for UI: "Matching at 1.08×") */
  referencePlaybackSpeed?: number;
}

export interface SampleSuggestion {
  track: SuggestionCandidate;
  score: number;
  adjustmentLine: string;
  /** Suggested playback speed when adding this track to align with reference (0.5–2) */
  suggestedSpeed?: number;
  /** One-line hint e.g. "Try ~1.05× for tempo match" */
  suggestedSpeedReason?: string;
}

function parseKey(key: string | null | undefined): { root: number; minor: boolean } | null {
  if (!key || typeof key !== 'string') return null;
  const m = key.trim().match(KEY_REGEX);
  if (!m) return null;
  const rootStr = m[1];
  const q = m[2]?.toLowerCase();
  const minor = q === 'm' || q === 'min';
  const root = NOTE_TO_SEMITONE[rootStr];
  if (root === undefined) return null;
  return { root, minor };
}

/** Shortest signed semitone delta from candidate root to reference root (align cand to ref). */
function rootDeltaToRef(refRoot: number, candRoot: number): number {
  let d = refRoot - candRoot;
  while (d > 6) d -= 12;
  while (d < -6) d += 12;
  return d;
}

function circularRootDistance(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 12 - d);
}

const KEY_SCORE = { exact: 52, relative: 36, compatible: 22, distant: 8, mixed: 6 } as const;
const TEMPO_SCORE = { exact: 52, near: 30, stretchable: 12, far: 0 } as const;

const MIN_COMBINED_SCORE = 24;
const MIN_COMBINED_RELAXED = 16;
const MAX_SUGGESTIONS = 6;

function keyMatchScore(
  ref: { root: number; minor: boolean },
  cand: { root: number; minor: boolean }
): { score: number; label: string } {
  const sameMode = ref.minor === cand.minor;
  const sameRoot = ref.root === cand.root;

  if (sameMode && sameRoot) {
    return { score: KEY_SCORE.exact, label: 'Matches key' };
  }

  // Relative major/minor: minor root + 3 = relative major root
  const relativePair =
    (ref.minor &&
      !cand.minor &&
      cand.root === (ref.root + 3) % 12) ||
    (!ref.minor && cand.minor && ref.root === (cand.root + 3) % 12);
  if (relativePair) {
    return { score: KEY_SCORE.relative, label: 'Relative key' };
  }

  if (sameMode) {
    const dist = circularRootDistance(ref.root, cand.root);
    const delta = rootDeltaToRef(ref.root, cand.root);
    const semi =
      delta === 0
        ? ''
        : delta > 0
          ? `+${delta} semitone${delta === 1 ? '' : 's'}`
          : `${delta} semitone${delta === -1 ? '' : 's'}`;
    if (dist >= 1 && dist <= 3) {
      return {
        score: KEY_SCORE.compatible,
        label: semi || 'Close key',
      };
    }
    return {
      score: KEY_SCORE.distant,
      label: semi || 'Different key',
    };
  }

  const dist = circularRootDistance(ref.root, cand.root);
  const delta = rootDeltaToRef(ref.root, cand.root);
  const semi =
    delta === 0
      ? 'Mode differs'
      : delta > 0
        ? `+${delta} semitone${delta === 1 ? '' : 's'}`
        : `${delta} semitone${delta === 1 ? '' : 's'}`;
  return {
    score: KEY_SCORE.mixed,
    label: dist <= 3 ? semi : 'Different key',
  };
}

function tempoMatchScore(
  refBpm: number,
  candBpm: number
): { score: number; label: string } {
  const d = Math.abs(refBpm - candBpm);
  if (d === 0) return { score: TEMPO_SCORE.exact, label: 'Tempo match' };
  if (d <= 5) {
    const sign = candBpm > refBpm ? '+' : '';
    return {
      score: TEMPO_SCORE.near,
      label: `${sign}${candBpm - refBpm} BPM`,
    };
  }
  if (d <= 15) {
    const sign = candBpm > refBpm ? '+' : '';
    return {
      score: TEMPO_SCORE.stretchable,
      label: `${sign}${candBpm - refBpm} BPM`,
    };
  }
  return { score: TEMPO_SCORE.far, label: `${candBpm > refBpm ? '+' : ''}${candBpm - refBpm} BPM` };
}

function validBpm(b: number | null | undefined): b is number {
  return typeof b === 'number' && Number.isFinite(b) && b >= 40 && b <= 300;
}

const SPEED_MIN = 0.5;
const SPEED_MAX = 2;

function clampSpeed(s: number): number {
  if (!Number.isFinite(s) || s <= 0) return 1;
  return Math.max(SPEED_MIN, Math.min(SPEED_MAX, s));
}

function formatSpeed(s: number): string {
  const n = clampSpeed(s);
  if (Math.abs(n - 1) < 0.02) return '1.0×';
  return `${n.toFixed(2)}×`;
}

/**
 * Compute suggested playback speed for a candidate so it aligns with reference (effective key + BPM).
 * One speed affects both; we suggest best compromise or single-dimension match.
 */
function suggestedSpeedForCandidate(
  refKey: { root: number; minor: boolean } | null,
  refBpm: number | null,
  candKey: { root: number; minor: boolean } | null,
  candBpm: number | null
): { suggestedSpeed: number; suggestedSpeedReason: string } | undefined {
  const hasKey = refKey && candKey;
  const hasTempo = refBpm != null && refBpm > 0 && candBpm != null && candBpm > 0;

  if (!hasKey && !hasTempo) return undefined;

  let S_tempo: number | null = null;
  let S_key: number | null = null;

  if (hasTempo) {
    S_tempo = clampSpeed(refBpm! / candBpm!);
  }

  if (hasKey) {
    const refRoot = refKey!.root;
    const candRoot = candKey!.root;
    let semitones = refRoot - candRoot;
    while (semitones > 6) semitones -= 12;
    while (semitones < -6) semitones += 12;
    S_key = clampSpeed(Math.pow(2, semitones / 12));
  }

  if (S_tempo != null && S_key == null) {
    return {
      suggestedSpeed: S_tempo,
      suggestedSpeedReason: `Try ${formatSpeed(S_tempo)} for tempo match`,
    };
  }
  if (S_key != null && S_tempo == null) {
    return {
      suggestedSpeed: S_key,
      suggestedSpeedReason: `Try ${formatSpeed(S_key)} for key match`,
    };
  }

  const compromise = clampSpeed(Math.sqrt(S_tempo! * S_key!));
  const atTempo = Math.abs(compromise - S_tempo!) < 0.03;
  const atKey = Math.abs(compromise - S_key!) < 0.03;
  if (atTempo && atKey) {
    return {
      suggestedSpeed: compromise,
      suggestedSpeedReason: `Try ${formatSpeed(compromise)} to align tempo and key`,
    };
  }
  if (atTempo) {
    const semi = Math.round(12 * Math.log2(compromise / S_key!));
    return {
      suggestedSpeed: compromise,
      suggestedSpeedReason: `Try ${formatSpeed(compromise)} (tempo match, key ${semi >= 0 ? '+' : ''}${semi} semitone${semi === 1 || semi === -1 ? '' : 's'})`,
    };
  }
  if (atKey) {
    const bpmDelta = Math.round((candBpm! * compromise) - refBpm!);
    return {
      suggestedSpeed: compromise,
      suggestedSpeedReason: `Try ${formatSpeed(compromise)} (key match, ${bpmDelta >= 0 ? '+' : ''}${bpmDelta} BPM)`,
    };
  }
  return {
    suggestedSpeed: compromise,
    suggestedSpeedReason: `Try ${formatSpeed(compromise)} to align with reference`,
  };
}

/**
 * Rank library tracks for suggestions. Returns 0–6 items; empty if nothing passes threshold.
 */
export function getSampleSuggestions(
  candidates: SuggestionCandidate[],
  reference: SuggestionReference
): SampleSuggestion[] {
  const refKey = reference.key?.trim() ? parseKey(reference.key) : null;
  const refBpm = validBpm(reference.bpm) ? reference.bpm : null;

  if (!refKey && refBpm === null) return [];

  const excludeId = reference.excludeTrackId;
  const excludeKey = reference.excludeFileKey;

  const scored: Array<{
    track: SuggestionCandidate;
    score: number;
    parts: string[];
  }> = [];

  for (const track of candidates) {
    if (excludeId && track.id === excludeId) continue;
    if (excludeKey && track.fileKey === excludeKey) continue;

    const candKey = track.key ? parseKey(track.key) : null;
    const candBpm = validBpm(track.bpm) ? track.bpm : null;

    if (!candKey && candBpm === null) continue;

    const parts: string[] = [];
    let score = 0;

    if (refKey && candKey) {
      const k = keyMatchScore(refKey, candKey);
      score += k.score;
      parts.push(k.label);
    }

    if (refBpm !== null && candBpm !== null) {
      const t = tempoMatchScore(refBpm, candBpm);
      score += t.score;
      parts.push(t.label);
    }

    if (score === 0) continue;
    scored.push({ track, score, parts });
  }

  scored.sort((a, b) => b.score - a.score);

  let picked = scored.filter((s) => s.score >= MIN_COMBINED_SCORE).slice(0, MAX_SUGGESTIONS);
  if (picked.length === 0) {
    picked = scored.filter((s) => s.score >= MIN_COMBINED_RELAXED).slice(0, MAX_SUGGESTIONS);
  }

  return picked.map((s) => {
    const candKey = s.track.key ? parseKey(s.track.key) : null;
    const candBpm = validBpm(s.track.bpm) ? s.track.bpm : null;
    const speedHint = suggestedSpeedForCandidate(
      refKey,
      refBpm,
      candKey,
      candBpm
    );
    return {
      track: s.track,
      score: s.score,
      adjustmentLine: s.parts.join(' • '),
      suggestedSpeed: speedHint?.suggestedSpeed,
      suggestedSpeedReason: speedHint?.suggestedSpeedReason,
    };
  });
}
