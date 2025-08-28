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

  function stop() {
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
    // Revoke only blob URLs we created
    if (
      currentKindRef.current === "blob" &&
      currentUrlRef.current?.startsWith("blob:")
    ) {
      URL.revokeObjectURL(currentUrlRef.current);
    }
    currentUrlRef.current = null;
    currentKindRef.current = null;
    currentKeyRef.current = null;
  }

  async function play(src: Playable) {
    const el = ensureAudio();
    // Stop previous sound + cleanup
    stop();

    let url: string;
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

    try {
      await el.play();
      setIsPlaying(true);
    } catch (err) {
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
      play(src).catch((e) => {
        console.error("Audio play failed:", e);
      });
    }
  }

  function isCurrentKey(key: string) {
    return currentKeyRef.current === key;
  }

  useEffect(() => () => stop(), []);

  return { audioRef, isPlaying, play, stop, toggle, isCurrentKey, currentKey: currentKeyRef.current };
}
