"use client";

import { useState } from "react";
import { Loader2, Mic, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";

export function ChatComposer({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const recorder = useVoiceRecorder();

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    setValue("");
    onSend(trimmed);
  }

  async function handleMicClick() {
    if (recorder.state === "recording") {
      const transcript = await recorder.stop();
      if (transcript) onSend(transcript);
    } else {
      recorder.start();
    }
  }

  const isBusy = disabled || recorder.state === "transcribing";

  return (
    <div className="flex items-center gap-2 border-t bg-background p-3">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="Ask a conceptual question about your notes..."
        disabled={isBusy}
        className="flex-1"
      />
      <Button
        variant="outline"
        size="icon"
        className={cn(recorder.state === "recording" && "border-verdict-incorrect text-verdict-incorrect")}
        onClick={handleMicClick}
        disabled={disabled}
      >
        {recorder.state === "transcribing" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : recorder.state === "recording" ? (
          <Square className="size-4" />
        ) : (
          <Mic className="size-4" />
        )}
      </Button>
      <Button size="icon" onClick={submit} disabled={isBusy || !value.trim()}>
        <Send className="size-4" />
      </Button>
    </div>
  );
}
