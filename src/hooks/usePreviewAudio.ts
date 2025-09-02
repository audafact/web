import { useEffect, useMemo, useState } from "react";
import { LibraryTrack } from "../types/music";
import { trackEvent } from "../services/analyticsService";
import { useUser } from "./useUser";
import { usePreviewFromProvider } from "../audio/usePreviewFromProvider";
import { signFile } from "../lib/api";
import { pickPlayableKey } from "@/services/libraryService";

type Tier = "guest" | "free" | "pro";

// ---- Decoded buffer LRU cache (process memory) ----
type BufEntry = { buffer: AudioBuffer; ts: number };
const bufferCache = new Map<string, BufEntry>();
const MAX_BUFFERS = 24; // tune as needed

function cachePut(key: string, buffer: AudioBuffer) {
  // If exists, refresh timestamp ordering
  if (bufferCache.has(key)) bufferCache.delete(key);
  bufferCache.set(key, { buffer, ts: Date.now() });

  // Evict oldest if over limit
  if (bufferCache.size > MAX_BUFFERS) {
    const oldestKey = bufferCache.keys().next().value;
    if (oldestKey) bufferCache.delete(oldestKey);
  }
}

function cacheGet(key: string): AudioBuffer | null {
  const hit = bufferCache.get(key);
  if (!hit) return null;
  // refresh LRU ordering
  bufferCache.delete(key);
  bufferCache.set(key, { ...hit, ts: Date.now() });
  return hit.buffer;
}

export const usePreviewAudio = () => {
  const { tier } = useUser();
  const {
    loadAndDecode,
    loadFromBuffer,
    getBuffer,
    playLoop,
    playCue,
    stop,
    isPlaying,
    duration,
  } = usePreviewFromProvider();

  const [currentTrack, setCurrentTrack] = useState<LibraryTrack | null>(null);

  const tierName: Tier = useMemo(() => {
    if (tier?.id === "pro") return "pro";
    if (tier?.id === "free") return "free";
    return "guest";
  }, [tier?.id]);

  const startPreview = async (track: LibraryTrack) => {
    try {
      // same-track restart: stop first
      if (currentTrack?.id === track.id && isPlaying) {
        stop();
      }

      const key = pickPlayableKey(track, tierName);

      // 1) Try decoded buffer cache
      const cached = cacheGet(key);
      if (cached) {
        loadFromBuffer(cached);
        playLoop(0);
        setCurrentTrack(track);
        return;
      }

      // 2) Miss: sign + decode, then cache
      const url = await signFile(key);
      await loadAndDecode(url);

      const buf = getBuffer();
      if (buf) cachePut(key, buf);

      playLoop(0);
      setCurrentTrack(track);

      trackEvent("library_track_previewed", {
        trackId: track.id,
        genre: track.genre,
        bpm: track.bpm,
        userTier: tierName,
      });
    } catch (err) {
      console.error("Failed to start preview:", err);
      setCurrentTrack(null);
    }
  };

  const stopPreview = () => {
    stop();
    setCurrentTrack(null);
  };

  const isPreviewing = (trackId: string) =>
    currentTrack?.id === trackId && isPlaying;

  const togglePreview = async (track: LibraryTrack) => {
    if (isPreviewing(track.id)) {
      stopPreview();
    } else {
      await startPreview(track);
    }
  };

  // Extra helpers for your UI
  const previewLoop = (loopStart = 0, loopEnd?: number) => {
    if (!currentTrack) return;
    playLoop(loopStart, loopEnd);
  };
  const previewCue = (offsetSec: number, durationSec?: number) => {
    if (!currentTrack) return;
    playCue(offsetSec, durationSec);
  };

  useEffect(() => () => stop(), []);

  return {
    startPreview,
    stopPreview,
    isPreviewing,
    togglePreview,
    currentTrack,
    previewLoop,
    previewCue,
    isPlaying,
    duration,
  };
};
