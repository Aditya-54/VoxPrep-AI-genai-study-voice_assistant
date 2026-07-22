import { apiPostForm } from "./client";
import type { TranscriptionResult } from "./types";

export function transcribeAudio(blob: Blob): Promise<TranscriptionResult> {
  const formData = new FormData();
  formData.append("file", blob, "record.webm");
  return apiPostForm<TranscriptionResult>("/voice/transcribe", formData);
}

export function speakUrl(text: string): string {
  return `/api/voice/speak?text=${encodeURIComponent(text)}`;
}
