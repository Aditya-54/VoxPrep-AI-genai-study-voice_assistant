"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionListItem } from "@/components/chat/SessionListItem";
import { createChatSession, deleteChatSession, getChatSessions } from "@/lib/api/research";

export function ChatSessionSidebar({ activeSessionId }: { activeSessionId?: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: sessions, isLoading } = useQuery({ queryKey: ["chat-sessions"], queryFn: getChatSessions });

  const createMutation = useMutation({
    mutationFn: createChatSession,
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
      router.push(`/research/${session.id}`);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to start a new chat."),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteChatSession,
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
      if (deletedId === activeSessionId) router.push("/research");
    },
  });

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r">
      <div className="p-3">
        <Button
          className="w-full justify-start gap-2"
          variant="secondary"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
        >
          <Plus className="size-4" /> New Chat
        </Button>
      </div>
      <ScrollArea className="flex-1 px-2">
        {isLoading ? (
          <div className="space-y-2 p-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-lg" />
            ))}
          </div>
        ) : !sessions?.length ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            No conversations yet. Start one above.
          </p>
        ) : (
          <div className="space-y-1 pb-3">
            {sessions.map((s) => (
              <SessionListItem
                key={s.id}
                session={s}
                isActive={s.id === activeSessionId}
                onClick={() => router.push(`/research/${s.id}`)}
                onDelete={() => deleteMutation.mutate(s.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
