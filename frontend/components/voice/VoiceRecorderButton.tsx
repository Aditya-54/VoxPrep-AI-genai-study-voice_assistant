"use client";

import { Loader2, Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RecordingState } from "@/hooks/useVoiceRecorder";

export function VoiceRecorderButton({
  state,
  seconds,
  onStart,
  onStop,
}: {
  state: RecordingState;
  seconds: number;
  onStart: () => void;
  onStop: () => void;
}) {
  const isRecording = state === "recording";
  const isTranscribing = state === "transcribing";

  const label =
    state === "idle" ? "Tap to record your answer" : isRecording ? "Listening... tap to stop" : "Transcribing...";

  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");

  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <button
        type="button"
        disabled={isTranscribing}
        onClick={isRecording ? onStop : onStart}
        className={cn(
          "relative flex size-20 items-center justify-center rounded-full border-2 transition-all",
          isRecording
            ? "border-verdict-incorrect bg-verdict-incorrect/15 text-verdict-incorrect"
            : "border-primary bg-primary/10 text-primary hover:bg-primary/15",
          isTranscribing && "opacity-70"
        )}
      >
        {isRecording && (
          <span className="absolute inset-0 animate-ping rounded-full bg-verdict-incorrect/30" />
        )}
        {isTranscribing ? (
          <Loader2 className="size-7 animate-spin" />
        ) : isRecording ? (
          <Square className="size-6" />
        ) : (
          <Mic className="size-7" />
        )}
      </button>
      <div className="text-center">
        <p className="text-sm font-medium">{label}</p>
        {isRecording && <p className="font-mono text-xs text-muted-foreground">{mins}:{secs}</p>}
      </div>
    </div>
  );
}
