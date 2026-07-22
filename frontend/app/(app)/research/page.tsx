"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Sparkles } from "lucide-react";

import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { ChatSessionSidebar } from "@/components/chat/ChatSessionSidebar";
import { createChatSession } from "@/lib/api/research";

export default function ResearchLandingPage() {
  const router = useRouter();

  const createMutation = useMutation({
    mutationFn: createChatSession,
    onSuccess: (session) => router.push(`/research/${session.id}`),
    onError: (err: Error) => toast.error(err.message || "Failed to start a new chat."),
  });

  return (
    <>
      <TopBar title="Research Assistant" description="Ask conceptual questions across your notes and slides" />
      <div className="flex h-[calc(100vh-73px)]">
        <ChatSessionSidebar />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="size-7" />
          </div>
          <div>
            <p className="text-lg font-medium">Start a research conversation</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Ask about your uploaded course notes, slides, or personal study notes and get
              grounded, cited answers.
            </p>
          </div>
          <Button className="gap-2" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            <Plus className="size-4" /> New Chat
          </Button>
        </div>
      </div>
    </>
  );
}
