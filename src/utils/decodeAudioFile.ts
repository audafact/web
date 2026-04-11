/**
 * Decode a File to AudioBuffer without touching the shared Studio AudioContext.
 * Uses OfflineAudioContext.decodeAudioData only — no running audio graph — so Chrome/Safari
 * autoplay policy does not block initial load; the real AudioContext is created on first
 * playback via ensureAudio / initializeAudio (user gesture).
 */
export async function decodeAudioFileToBufferWithoutRunningContext(
  file: File
): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const Offline =
    typeof OfflineAudioContext !== 'undefined'
      ? OfflineAudioContext
      : typeof window !== 'undefined'
        ? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
            .webkitOfflineAudioContext
        : undefined;
  if (!Offline) {
    throw new Error('Web Audio API (OfflineAudioContext) is not available in this browser.');
  }
  const offline = new Offline(1, 1, 44100);
  return offline.decodeAudioData(arrayBuffer.slice(0));
}
