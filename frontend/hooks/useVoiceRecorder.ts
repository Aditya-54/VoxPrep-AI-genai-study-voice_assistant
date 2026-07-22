"use client";

import { useCallback, useRef, useState } from "react";
import { transcribeAudio } from "@/lib/api/voice";

export type RecordingState = "idle" | "recording" | "transcribing";

export function useVoiceRecorder() {
  const [state, setState] = useState<RecordingState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();

      setState("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Microphone access denied or unavailable.");
    }
  }, []);

  const stop = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) {
        resolve("");
        return;
      }

      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setState("transcribing");

        try {
          const result = await transcribeAudio(blob);
          setState("idle");
          if (result.status === "success" && result.transcription) {
            resolve(result.transcription);
          } else {
            setError("Could not transcribe audio. Please type your answer instead.");
            resolve("");
          }
        } catch {
          setState("idle");
          setError("Transcription request failed.");
          resolve("");
        }
      };

      recorder.stop();
    });
  }, []);

  const cancel = useCallback(() => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    setState("idle");
    setSeconds(0);
  }, []);

  return { state, seconds, error, start, stop, cancel };
}
