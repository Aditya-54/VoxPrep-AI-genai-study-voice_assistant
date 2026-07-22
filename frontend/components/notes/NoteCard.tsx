"use client";

import { cn } from "@/lib/utils";
import type { Note } from "@/lib/api/types";

export function NoteCard({
  note,
  isActive,
  onClick,
}: {
  note: Note;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
        isActive ? "border-primary bg-primary/5" : "hover:bg-muted/60"
      )}
    >
      <p className="truncate text-sm font-medium">{note.title}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">
        {note.topic || "Untagged"} &middot; {new Date(note.timestamp).toLocaleDateString()}
      </p>
    </button>
  );
}
