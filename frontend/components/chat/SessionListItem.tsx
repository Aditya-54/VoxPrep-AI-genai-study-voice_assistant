"use client";

import { MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatSession } from "@/lib/api/types";

export function SessionListItem({
  session,
  isActive,
  onClick,
  onDelete,
}: {
  session: ChatSession;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm",
        isActive ? "bg-primary/10 text-foreground" : "hover:bg-muted/70"
      )}
    >
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{session.title}</span>
      </button>
      <Button
        variant="ghost"
        size="icon-xs"
        className="shrink-0 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
