export type GuidedAssetType = "mp3" | "wav" | "m4a";

export interface GuidedBreakAsset {
  id: string;
  name: string;
  file: string;
  type: GuidedAssetType;
  bpm: number;
  key?: string;
  loopStart: number;
  loopEnd: number;
}

export interface GuidedGenAiAsset {
  id: string;
  name: string;
  file: string;
  type: GuidedAssetType;
  bpm: number;
  key?: string;
}

export interface GuidedSessionPair {
  id: string;
  breakAsset: GuidedBreakAsset;
  genAiAsset: GuidedGenAiAsset;
  genAiVolume: number;
  genAiPlaybackSpeed: number;
}

const BREAK_NO_REPEAT_KEY = "guidedDemo:lastBreakId";
const GEN_AI_NO_REPEAT_KEY = "guidedDemo:lastGenAiId";
const PAIR_NO_REPEAT_KEY = "guidedDemo:lastPairId";

export const GUIDED_BREAKS: GuidedBreakAsset[] = [
  {
    id: "fat-snare-natural-tape-compression-i",
    name: "Fat Snare Natural Tape Compression I",
    file: "/assets/drumbreaks/Fat Snare Natural Tape Compression I.m4a",
    type: "m4a",
    bpm: 82,
    loopStart: 5.65,
    loopEnd: 11.03,
  },
  {
    id: "fat-snare-natural-tape-compression-ii",
    name: "Fat Snare Natural Tape Compression II",
    file: "/assets/drumbreaks/Fat Snare Natural Tape Compression II.m4a",
    type: "m4a",
    bpm: 89,
    loopStart: 4.03,
    loopEnd: 15.84,
  },
];

export const GUIDED_GEN_AI: GuidedGenAiAsset[] = [
  {
    id: "feel-the-rhythm-now-version-1",
    name: "Feel the Rhythm Now (Version 1)",
    file: "/assets/gen-ai/feel-the-rhythm-now-version-1.mp3",
    type: "mp3",
    bpm: 148,
    key: "D#",
  },
  {
    id: "hearts-are-golden",
    name: "Hearts Are Golden",
    file: "/assets/gen-ai/hearts-are-golden.mp3",
    type: "mp3",
    bpm: 96,
    key: "A#",
  },
];

function pickRandomNoRepeat<T extends { id: string }>(
  options: T[],
  storageKey: string
): T {
  const last = localStorage.getItem(storageKey);
  const pool = options.length > 1 ? options.filter((opt) => opt.id !== last) : options;
  const selected = pool[Math.floor(Math.random() * pool.length)];
  localStorage.setItem(storageKey, selected.id);
  return selected;
}

export function pickRandomGuidedBreak(): GuidedBreakAsset {
  return pickRandomNoRepeat(GUIDED_BREAKS, BREAK_NO_REPEAT_KEY);
}

export function pickRandomGuidedGenAi(): GuidedGenAiAsset {
  return pickRandomNoRepeat(GUIDED_GEN_AI, GEN_AI_NO_REPEAT_KEY);
}

export const GUIDED_SESSION_PAIRS: GuidedSessionPair[] = [
  {
    id: "pair-fat-snare-i-feel-rhythm",
    breakAsset: GUIDED_BREAKS[0],
    genAiAsset: GUIDED_GEN_AI[0],
    genAiVolume: 0.22,
    genAiPlaybackSpeed: 1.31,
  },
  {
    id: "pair-fat-snare-ii-hearts-golden",
    breakAsset: GUIDED_BREAKS[1],
    genAiAsset: GUIDED_GEN_AI[1],
    genAiVolume: 0.24,
    genAiPlaybackSpeed: 0.93,
  },
];

export function pickRandomGuidedSessionPair(): GuidedSessionPair {
  return pickRandomNoRepeat(GUIDED_SESSION_PAIRS, PAIR_NO_REPEAT_KEY);
}
