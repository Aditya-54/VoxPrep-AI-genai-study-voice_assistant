import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export function SourceCitation({
  source,
  page,
  className,
}: {
  source: string;
  page: number | string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border bg-muted/60 px-2 py-1 font-mono text-xs text-muted-foreground",
        className
      )}
    >
      <FileText className="size-3.5" />
      <span className="max-w-[16rem] truncate">{source}</span>
      <span className="text-muted-foreground/70">· p.{page}</span>
    </span>
  );
}
