import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * Logs when: (1) iOS/iPadOS + Vite dev, or (2) `?debugIosAudio=1`, or
 * (3) `localStorage.setItem('audafact_debug_ios_audio','1')` (useful on staging without dev build).
 */
function iosAudioDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).get('debugIosAudio') === '1') {
      return true;
    }
  } catch {
    /* ignore */
  }
  try {
    if (localStorage.getItem('audafact_debug_ios_audio') === '1') return true;
  } catch {
    /* ignore */
  }
  return import.meta.env.DEV && isIOSWebAudioTarget();
}

function logIosAudio(reason: string, payload?: Record<string, unknown>) {
  if (!iosAudioDebugEnabled()) return;
  const line = { t: new Date().toISOString(), reason, ...payload };
  console.log('[Audafact iOS audio]', line);
}

function warnIosAudio(reason: string, payload?: Record<string, unknown>) {
  if (!iosAudioDebugEnabled()) return;
  console.warn('[Audafact iOS audio]', reason, { t: new Date().toISOString(), ...payload });
}

/** Exported for TrackControls: iOS may report `AudioContext` as `running` before WebAudio is routed to the speaker. */
export function isIOSWebAudioTarget(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** Tiny WAV (PCM) — near-silent output; wakes iOS media audio session for WebAudio. */
function silentWavBlob(durationSec: number): Blob {
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i) & 0xff);
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  return new Blob([buffer], { type: 'audio/wav' });
}

let iosMediaPrimeEl: HTMLAudioElement | null = null;

/**
 * iOS often routes WebAudio to built-in speaker only after HTMLMediaElement playback
 * (see menu previews via useSingleAudio). Stopping that media can drop the route again;
 * call this before starting Studio BufferSources, still inside the user gesture when possible.
 *
 * @param reason — caller label for debug logs (e.g. `trackcontrols:toggle-play`).
 */
export async function primeIosSessionForWebAudio(reason = 'unspecified'): Promise<void> {
  if (!isIOSWebAudioTarget()) {
    return;
  }

  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;

  try {
    if (!iosMediaPrimeEl) {
      iosMediaPrimeEl = new Audio();
      iosMediaPrimeEl.preload = 'auto';
      iosMediaPrimeEl.setAttribute('playsinline', '');
      logIosAudio('HTMLAudio prime element created', { reason });
    }
    const el = iosMediaPrimeEl;
    try {
      el.pause();
    } catch {
      /* ignore */
    }
    const prev = el.currentSrc || el.src;
    if (prev.startsWith('blob:')) {
      URL.revokeObjectURL(prev);
    }

    const url = URL.createObjectURL(silentWavBlob(0.05));
    el.src = url;
    el.volume = 0.001;

    logIosAudio('prime HTMLAudio play() start', {
      reason,
      volume: el.volume,
      muted: el.muted,
      readyState: el.readyState,
      networkState: el.networkState,
    });

    let playRejected: string | undefined;
    const playPromise = el.play();
    if (playPromise !== undefined) {
      await playPromise.catch((e: unknown) => {
        playRejected = e instanceof Error ? e.message : String(e);
      });
    }

    if (playRejected) {
      warnIosAudio('HTMLAudio play() rejected', { reason, playRejected });
    } else {
      logIosAudio('HTMLAudio play() settled ok', { reason });
    }

    await new Promise<void>((resolve) => {
      const done = () => {
        window.clearTimeout(tid);
        try {
          el.pause();
        } catch {
          /* ignore */
        }
        URL.revokeObjectURL(url);
        resolve();
      };
      const tid = window.setTimeout(done, 90);
      el.onended = done;
    });

    const ms = typeof performance !== 'undefined' ? Math.round(performance.now() - t0) : undefined;
    logIosAudio('prime finished', { reason, elapsedMs: ms });
  } catch (e) {
    warnIosAudio('prime threw', {
      reason,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

interface AudioContextProviderProps {
  children: React.ReactNode;
}

interface AudioContextValue {
  audioContext: AudioContext | null;
  initializeAudio: () => Promise<AudioContext>;
  resumeAudioContext: () => Promise<void>;
  primeIosSessionForWebAudio: (reason?: string) => Promise<void>;
}

const AudioContextInstance = createContext<AudioContextValue | null>(null);

export const AudioProvider: React.FC<AudioContextProviderProps> = ({ children }) => {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  const initializeAudio = useCallback(async (): Promise<AudioContext> => {
    try {
      // Create a new context if one doesn't exist
      if (!audioContext) {
        // Create a new AudioContext with explicit options to ensure compatibility
        const newContext = new (window.AudioContext || (window as any).webkitAudioContext)({
          // Some browsers may require a sample rate to be specified
          sampleRate: 44100,
          // Start in a resumed state where possible
          latencyHint: 'interactive'
        });
        
        // If the state is suspended, we need to explicitly resume it
        logIosAudio('initializeAudio: new AudioContext', {
          stateAfterCreate: newContext.state,
          sampleRate: newContext.sampleRate,
        });

        if (newContext.state === 'suspended') {
          try {
            await newContext.resume();
            logIosAudio('initializeAudio: resume() ok', { state: newContext.state });
          } catch (resumeError) {
            console.error('Failed to resume audio context:', resumeError);
            warnIosAudio('initializeAudio: resume() failed', {
              error: resumeError instanceof Error ? resumeError.message : String(resumeError),
            });
            // Continue anyway - we'll try to handle it later
          }
        }

        await primeIosSessionForWebAudio('initializeAudio:after-context');

        setAudioContext(newContext);
        return newContext;
      }
      
      // If context exists but is suspended, resume it
      if (audioContext.state === 'suspended') {
        logIosAudio('initializeAudio: existing context suspended, resuming', {
          state: audioContext.state,
        });
        await audioContext.resume();
        await primeIosSessionForWebAudio('initializeAudio:resume-existing');
      } else {
        logIosAudio('initializeAudio: reuse running context', {
          state: audioContext.state,
        });
      }
      
      return audioContext;
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      throw error;
    }
  }, [audioContext]);
  
  const resumeAudioContext = useCallback(async (): Promise<void> => {
    try {
      if (audioContext && audioContext.state === 'suspended') {
        logIosAudio('resumeAudioContext: before resume', { state: audioContext.state });
        await audioContext.resume();
        logIosAudio('resumeAudioContext: after resume', { state: audioContext.state });
        await primeIosSessionForWebAudio('resumeAudioContext');
      } else if (audioContext && iosAudioDebugEnabled()) {
        logIosAudio('resumeAudioContext: skipped (not suspended)', {
          state: audioContext.state,
        });
      }
    } catch (error) {
      console.error('Failed to resume audio context:', error);
      throw error;
    }
  }, [audioContext]);

  const value = {
    audioContext,
    initializeAudio,
    resumeAudioContext,
    primeIosSessionForWebAudio
  };

  return (
    <AudioContextInstance.Provider value={value}>
      {children}
    </AudioContextInstance.Provider>
  );
};

export const AudioContextProvider = AudioProvider;

export const useAudioContext = (): AudioContextValue => {
  const context = useContext(AudioContextInstance);
  if (!context) {
    throw new Error('useAudioContext must be used within an AudioProvider');
  }
  return context;
};
