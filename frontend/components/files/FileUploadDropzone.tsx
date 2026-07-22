"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadFile } from "@/lib/api/files";

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".pptx"];

export function FileUploadDropzone() {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: uploadFile,
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Upload failed.");
    },
  });

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      toast.error("Unsupported file format. Please upload PDF, DOCX, or PPTX.");
      return;
    }
    mutation.mutate(file);
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
        isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.pptx"
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      {mutation.isPending ? (
        <Loader2 className="size-8 animate-spin text-primary" />
      ) : (
        <UploadCloud className="size-8 text-muted-foreground" />
      )}
      <div>
        <p className="text-sm font-medium">
          {mutation.isPending ? "Uploading and indexing..." : "Drag & drop a file, or click to browse"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Supports PDF, DOCX, and PPTX</p>
      </div>
    </div>
  );
}
