import { apiDelete, apiGet, apiPost } from "./client";
import type { Note } from "./types";

export function getNotes(): Promise<Note[]> {
  return apiGet<Note[]>("/notes");
}

export function saveNote(
  title: string,
  content: string,
  topic: string,
  noteId?: number
): Promise<{ status: string; note_id: number; message: string }> {
  return apiPost("/notes", { title, content, topic, note_id: noteId ?? null });
}

export function deleteNote(noteId: number): Promise<{ status: string; message: string }> {
  return apiDelete(`/notes/${noteId}`);
}
