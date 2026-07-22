"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { NotebookPen } from "lucide-react";

import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { NoteCard } from "@/components/notes/NoteCard";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { deleteNote, getNotes, saveNote } from "@/lib/api/notes";

export default function NotesPage() {
  const queryClient = useQueryClient();
  const { data: notes, isLoading } = useQuery({ queryKey: ["notes"], queryFn: getNotes });

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [content, setContent] = useState("");

  function resetEditor() {
    setSelectedId(null);
    setTitle("");
    setTopic("");
    setContent("");
  }

  function selectNote(noteId: number) {
    const note = notes?.find((n) => n.id === noteId);
    if (!note) return;
    setSelectedId(note.id);
    setTitle(note.title);
    setTopic(note.topic);
    setContent(note.content);
  }

  const saveMutation = useMutation({
    mutationFn: () => saveNote(title.trim(), content.trim(), topic.trim(), selectedId ?? undefined),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      setSelectedId(data.note_id);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to save note."),
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: number) => deleteNote(noteId),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      resetEditor();
    },
  });

  function handleSave() {
    if (!title.trim() || !content.trim()) {
      toast.error("Note must contain a title and content.");
      return;
    }
    saveMutation.mutate();
  }

  return (
    <>
      <TopBar title="Study Notes" description="Personal notes are auto-indexed for the Research assistant" />
      <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Your Notes</CardTitle>
                <CardDescription>Select a note to edit</CardDescription>
              </div>
              <Button size="sm" variant="secondary" onClick={resetEditor}>
                New
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[28rem]">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : !notes?.length ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                  <NotebookPen className="size-6" />
                  No notes yet. Create your first one.
                </div>
              ) : (
                <div className="space-y-2 pr-2">
                  {notes.map((n) => (
                    <NoteCard key={n.id} note={n} isActive={n.id === selectedId} onClick={() => selectNote(n.id)} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{selectedId ? "Edit Note" : "New Note"}</CardTitle>
            <CardDescription>Notes are chunked and embedded automatically on save</CardDescription>
          </CardHeader>
          <CardContent>
            <NoteEditor
              title={title}
              topic={topic}
              content={content}
              onTitleChange={setTitle}
              onTopicChange={setTopic}
              onContentChange={setContent}
              onSave={handleSave}
              onDelete={() => selectedId && deleteMutation.mutate(selectedId)}
              isSaving={saveMutation.isPending}
              isEditing={selectedId !== null}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
