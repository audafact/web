import { useEffect, useRef, useState } from "react";
import { getSignedUrl } from "@/lib/storage";

type Playable =
  | { kind: "key"; key: string } // R2 object key for library/user items
  | { kind: "blob"; blob: Blob }; // in-memory recordings

export function useSingleAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentUrlRef = useRef<string | null>(null);
  const currentKindRef = useRef<Playable["kind"] | null>(null);
  const currentKeyRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  function ensureAudio() {
    if (!audioRef.current) {
      const el = new Audio();
      el.preload = "auto";
      el.onplay = () => setIsPlaying(true);
      el.onpause = () => setIsPlaying(false);
      el.onended = () => setIsPlaying(false);
      audioRef.current = el;
    }
    return audioRef.current!;
  }

  function stop(clearKey = true) {
    const el = audioRef.current;
    if (el) {
      try {
        el.pause();
      } catch {}
      try {
        el.currentTime = 0;
      } catch {}
    }
    setIsPlaying(false);
    if (clearKey) {
      setIsLoading(false);
    }
    // Revoke only blob URLs we created
    if (
      currentKindRef.current === "blob" &&
      currentUrlRef.current?.startsWith("blob:")
    ) {
      URL.revokeObjectURL(currentUrlRef.current);
    }
    currentUrlRef.current = null;
    if (clearKey) {
      currentKindRef.current = null;
      currentKeyRef.current = null;
    }
  }

  async function play(src: Playable) {
    const el = ensureAudio();
    // Stop previous sound + cleanup, but preserve key if it's the same track
    const isSameKey = src.kind === "key" && currentKeyRef.current === src.key;
    stop(!isSameKey);

    if (!isLoading) {
      setIsLoading(true);
    }

    let url: string;
    try {
      if (src.kind === "key") {
        url = await getSignedUrl(src.key);
        currentKindRef.current = "key";
        currentKeyRef.current = src.key;
      } else {
        url = URL.createObjectURL(src.blob);
        currentKindRef.current = "blob";
        currentKeyRef.current = null;
      }

      currentUrlRef.current = url;
      el.src = url;

      await el.play();
      setIsPlaying(true);
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      if (
        currentKindRef.current === "blob" &&
        currentUrlRef.current?.startsWith("blob:")
      ) {
        URL.revokeObjectURL(currentUrlRef.current);
      }
      currentUrlRef.current = null;
      currentKindRef.current = null;
      currentKeyRef.current = null;
      throw err;
    }
  }

  function toggle(src: Playable) {
    const el = ensureAudio();
    if (
      isPlaying &&
      el.src &&
      currentUrlRef.current &&
      el.src === currentUrlRef.current
    ) {
      stop();
    } else {
      // Set loading state and current key immediately for UI feedback
      setIsLoading(true);
      if (src.kind === "key") {
        currentKeyRef.current = src.key;
      }
      play(src).catch((e) => {
        console.error("Audio play failed:", e);
        setIsLoading(false);
        // Reset current key on error
        currentKeyRef.current = null;
      });
    }
  }

  function isCurrentKey(key: string) {
    return currentKeyRef.current === key;
  }

  useEffect(() => () => stop(), []);

  return {
    audioRef,
    isPlaying,
    isLoading,
    play,
    stop,
    toggle,
    isCurrentKey,
    currentKey: currentKeyRef.current,
  };
}
