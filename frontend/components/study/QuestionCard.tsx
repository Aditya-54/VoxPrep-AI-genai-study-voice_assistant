import { Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SourceMetadata } from "@/lib/api/types";

export function QuestionCard({
  question,
  metadata,
  isSpeaking,
  onSpeak,
}: {
  question: string;
  metadata?: SourceMetadata;
  isSpeaking: boolean;
  onSpeak: () => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        {metadata?.source_file ? <Badge variant="secondary">{metadata.source_file}</Badge> : null}
        {metadata?.page_number ? <Badge variant="outline">Page {metadata.page_number}</Badge> : null}
      </div>
      <p className="text-lg font-medium leading-relaxed">{question}</p>
      <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={onSpeak} disabled={isSpeaking}>
        <Volume2 className="size-4" />
        {isSpeaking ? "Playing..." : "Listen"}
      </Button>
    </div>
  );
}
