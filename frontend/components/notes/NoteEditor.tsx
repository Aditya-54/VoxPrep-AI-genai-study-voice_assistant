"use client";

import { Loader2, Save, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function NoteEditor({
  title,
  topic,
  content,
  onTitleChange,
  onTopicChange,
  onContentChange,
  onSave,
  onDelete,
  isSaving,
  isEditing,
}: {
  title: string;
  topic: string;
  content: string;
  onTitleChange: (v: string) => void;
  onTopicChange: (v: string) => void;
  onContentChange: (v: string) => void;
  onSave: () => void;
  onDelete: () => void;
  isSaving: boolean;
  isEditing: boolean;
}) {
  return (
    <div className="flex h-full flex-col gap-3">
      <Input
        placeholder="Note Title (e.g. Introduction to Ethics)"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="text-base font-medium"
      />
      <div className="space-y-1.5">
        <Label>Topic Tag</Label>
        <Input placeholder="e.g. CSET208" value={topic} onChange={(e) => onTopicChange(e.target.value)} />
      </div>
      <Textarea
        placeholder="Write your personal summaries, notes, or explanations here. These are automatically indexed so you can query them in Research chat."
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        className="min-h-[16rem] flex-1"
      />
      <div className="flex items-center gap-2">
        <Button onClick={onSave} disabled={isSaving} className="gap-2">
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {isEditing ? "Update & Re-index" : "Save & Index Note"}
        </Button>
        {isEditing && (
          <Button variant="ghost" onClick={onDelete} className="gap-2 text-destructive hover:bg-destructive/10">
            <Trash2 className="size-4" /> Delete
          </Button>
        )}
      </div>
    </div>
  );
}
