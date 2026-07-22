import { apiDelete, apiGet, apiPostForm } from "./client";
import type { FileEntry } from "./types";

export interface UploadResult {
  status: string;
  filename: string;
  chunks: number;
  message: string;
}

export function getFiles(): Promise<FileEntry[]> {
  return apiGet<FileEntry[]>("/files");
}

export function uploadFile(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  return apiPostForm<UploadResult>("/upload", formData);
}

export function deleteFile(filename: string): Promise<{ status: string; message: string }> {
  return apiDelete(`/files/${encodeURIComponent(filename)}`);
}
