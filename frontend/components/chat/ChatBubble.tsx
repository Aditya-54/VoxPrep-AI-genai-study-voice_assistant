import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { SourceCitation } from "@/components/shared/SourceCitation";
import type { Citation } from "@/lib/api/types";

export function ChatBubble({
  role,
  content,
  citations,
}: {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}) {
  const isUser = role === "user";

  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>
      <div
        className={cn(
          "min-w-0 max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-card text-card-foreground border"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-muted">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
        {citations && citations.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {dedupeCitations(citations).map((c, i) => (
              <SourceCitation key={i} source={c.source} page={c.page} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function dedupeCitations(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  const result: Citation[] = [];
  for (const c of citations) {
    const key = `${c.source}_${c.page}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(c);
    }
  }
  return result;
}
