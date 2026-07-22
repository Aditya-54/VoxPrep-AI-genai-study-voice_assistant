"use client";

import { useCallback, useRef, useState } from "react";
import { speakUrl } from "@/lib/api/voice";

export function useAudioPlayback() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = useCallback((text: string) => {
    audioRef.current?.pause();
    const audio = new Audio(speakUrl(text));
    audioRef.current = audio;
    setIsSpeaking(true);
    audio.onended = () => setIsSpeaking(false);
    audio.onerror = () => setIsSpeaking(false);
    audio.play().catch(() => setIsSpeaking(false));
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setIsSpeaking(false);
  }, []);

  return { isSpeaking, speak, stop };
}
