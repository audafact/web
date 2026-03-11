/**
 * Transpose a musical key by semitones.
 * Used when playback speed changes pitch (e.g. Web Audio playbackRate).
 * Formula: pitch shift in semitones = 12 * log2(playbackSpeed)
 */

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

const SEMITONE_TO_NOTE_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Match key pattern: optional note (with #/b), optional m/min for minor */
const KEY_REGEX = /^(C#|Db|D#|Eb|F#|Gb|G#|Ab|A#|Bb|[CDEFGAB])(m|min|maj|major)?$/i;

/**
 * Transpose a musical key string by the given number of semitones.
 * @param key - Original key (e.g. "Am", "C", "F#", "Bb")
 * @param semitones - Number of semitones to shift (positive = up, negative = down)
 * @returns Transposed key string, or original key if parsing fails
 */
export function transposeKey(key: string | undefined, semitones: number): string | undefined {
  if (!key || typeof key !== 'string' || key.trim() === '') return undefined;
  const trimmed = key.trim();
  const match = trimmed.match(KEY_REGEX);
  if (!match) return key;

  const rootStr = match[1];
  const quality = match[2]?.toLowerCase();
  const isMinor = quality === 'm' || quality === 'min';
  const rootSemitone = NOTE_TO_SEMITONE[rootStr];
  if (rootSemitone === undefined) return key;

  const newSemitone = ((rootSemitone + semitones) % 12 + 12) % 12;
  const newRoot = SEMITONE_TO_NOTE_SHARP[newSemitone];
  return isMinor ? `${newRoot}m` : newRoot;
}

/**
 * Calculate semitone shift from playback speed.
 * When speed doubles, pitch goes up 12 semitones (1 octave).
 */
export function semitonesFromPlaybackSpeed(speed: number): number {
  if (!Number.isFinite(speed) || speed <= 0) return 0;
  return Math.round(12 * Math.log2(speed));
}
