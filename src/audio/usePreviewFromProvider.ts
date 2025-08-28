// src/audio/usePreviewFromProvider.ts
import { useRef, useState, useEffect } from "react";
import { useAudioContext } from "@/context/AudioContext"; // keep your import

/**
 * Uses the shared AudioContext from your AudioProvider.
 * Decode once → loop/cue instantly. One source per hook instance.
 */
export function usePreviewFromProvider() {
  const { audioContext, initializeAudio, resumeAudioContext } =
    useAudioContext();

  const bufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [isLoaded, setLoaded] = useState(false);
  const [isPlaying, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);

  async function ensureCtx(): Promise<AudioContext> {
    const ctx = audioContext ?? (await initializeAudio());
    if (ctx.state === "suspended") {
      try {
        await resumeAudioContext();
      } catch {}
    }
    return ctx;
  }

  /** Download and decode audio into an AudioBuffer */
  async function loadAndDecode(url: string) {
    const ctx = await ensureCtx();
    stop();

    const resp = await fetch(url, {
      credentials: "omit",
      cache: "force-cache",
    });
    if (!resp.ok) throw new Error(`Audio fetch failed: ${resp.status}`);
    const arr = await resp.arrayBuffer();
    const buf = await ctx.decodeAudioData(arr.slice(0)); // Safari-safe copy

    bufferRef.current = buf;
    setDuration(buf.duration);
    setLoaded(true);
  }

  /** NEW: Load an already-decoded buffer (for cache hits) */
  function loadFromBuffer(buf: AudioBuffer) {
    stop();
    bufferRef.current = buf;
    setDuration(buf.duration);
    setLoaded(true);
  }

  /** NEW: Get current decoded buffer (so caller can cache it) */
  function getBuffer(): AudioBuffer | null {
    return bufferRef.current;
  }

  /** Loop playback between loopStart and loopEnd (seconds). If loopEnd omitted, loops to end. */
  function playLoop(loopStart = 0, loopEnd?: number) {
    const ctx = audioContext;
    const buf = bufferRef.current;
    if (!ctx || !buf) return;

    stop();

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const dur = buf.duration;
    const start = clamp(loopStart, 0, dur);
    const end = loopEnd != null ? clamp(loopEnd, start, dur) : dur;

    src.loopStart = start;
    src.loopEnd = end;
    src.connect(ctx.destination); // swap to master GainNode later if you add one
    src.start(0, start);

    sourceRef.current = src;
    setPlaying(true);
  }

  /** Play a short cue: start at offsetSec, optional durationSec (seconds) */
  function playCue(offsetSec: number, durationSec?: number) {
    const ctx = audioContext;
    const buf = bufferRef.current;
    if (!ctx || !buf) return;

    stop();

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);

    const start = clamp(offsetSec, 0, buf.duration);
    const len = durationSec && durationSec > 0 ? durationSec : undefined;

    src.start(0, start, len);
    sourceRef.current = src;
    setPlaying(true);

    if (len) {
      setTimeout(() => stop(), Math.ceil(len * 1000));
    } else {
      src.onended = () => stop();
    }
  }

  /** Stop current playback */
  function stop() {
    try {
      sourceRef.current?.stop();
    } catch {}
    try {
      sourceRef.current?.disconnect();
    } catch {}
    sourceRef.current = null;
    setPlaying(false);
  }

  /** Free decoded buffer to reclaim memory */
  function unload() {
    stop();
    bufferRef.current = null;
    setLoaded(false);
    setDuration(0);
  }

  useEffect(() => () => stop(), []);

  return {
    loadAndDecode,
    loadFromBuffer, // ← added
    getBuffer, // ← added
    playLoop,
    playCue,
    stop,
    unload,
    isLoaded,
    isPlaying,
    duration,
    buffer: bufferRef.current,
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(v, max));
}
