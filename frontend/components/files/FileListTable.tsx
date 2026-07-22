"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Presentation, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteFile, getFiles } from "@/lib/api/files";

function fileIcon(name: string) {
  if (name.endsWith(".pptx")) return Presentation;
  return FileText;
}

export function FileListTable() {
  const queryClient = useQueryClient();
  const { data: files, isLoading } = useQuery({ queryKey: ["files"], queryFn: getFiles });

  const mutation = useMutation({
    mutationFn: deleteFile,
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete file."),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!files?.length) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No files uploaded yet. Add study material to build your knowledge base.
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {files.map((f) => {
        const Icon = fileIcon(f.name);
        return (
          <li key={f.name} className="flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm font-medium">{f.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {(f.size / 1024).toFixed(1)} KB
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive hover:bg-destructive/10"
              disabled={mutation.isPending}
              onClick={() => {
                if (confirm(`Delete '${f.name}'? This removes it from the search index too.`)) {
                  mutation.mutate(f.name);
                }
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
