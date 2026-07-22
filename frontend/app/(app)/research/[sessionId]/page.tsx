"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Loader2 } from "lucide-react";

import { TopBar } from "@/components/layout/TopBar";
import { ChatSessionSidebar } from "@/components/chat/ChatSessionSidebar";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { getChatSession, sendResearchQuery } from "@/lib/api/research";
import type { ChatSessionDetail } from "@/lib/api/types";

export default function ActiveChatPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = Number(params.sessionId);
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: session, isLoading } = useQuery({
    queryKey: ["chat-session", sessionId],
    queryFn: () => getChatSession(sessionId),
    enabled: Number.isFinite(sessionId),
  });

  const sendMutation = useMutation({
    mutationFn: (text: string) => sendResearchQuery(text, sessionId),
    onMutate: (text: string) => {
      queryClient.setQueryData<ChatSessionDetail | undefined>(["chat-session", sessionId], (old) =>
        old
          ? {
              ...old,
              messages: [
                ...old.messages,
                {
                  id: Date.now(),
                  session_id: sessionId,
                  role: "user" as const,
                  content: text,
                  citations: [],
                  created_at: new Date().toISOString(),
                },
              ],
            }
          : old
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [session?.messages.length, sendMutation.isPending]);

  return (
    <>
      <TopBar title={session?.title ?? "Research Chat"} description="Grounded answers with source citations" />
      <div className="flex h-[calc(100vh-73px)]">
        <ChatSessionSidebar activeSessionId={sessionId} />
        <div className="flex flex-1 flex-col">
          <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto p-6">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading conversation...</p>
            ) : !session?.messages.length ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Ask your first question to get started.
              </p>
            ) : (
              session.messages.map((m) => (
                <ChatBubble key={m.id} role={m.role} content={m.content} citations={m.citations} />
              ))
            )}
            {sendMutation.isPending && (
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Bot className="size-4" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Searching your knowledge base...
                </div>
              </div>
            )}
          </div>
          <ChatComposer onSend={(text) => sendMutation.mutate(text)} disabled={sendMutation.isPending} />
        </div>
      </div>
    </>
  );
}
