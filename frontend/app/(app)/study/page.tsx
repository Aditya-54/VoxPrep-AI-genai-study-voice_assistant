"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GraduationCap, Mic, Trash2, Type } from "lucide-react";

import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getFiles } from "@/lib/api/files";
import { createQuizSession, deleteQuizSession, getQuizSessions } from "@/lib/api/quiz";
import type { QuizMode } from "@/lib/api/types";

const SMART_WEIGHTED = "__smart__";

export default function StudySetupPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<QuizMode>("text");
  const [topic, setTopic] = useState<string>(SMART_WEIGHTED);

  const { data: files } = useQuery({ queryKey: ["files"], queryFn: getFiles });
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["quiz-sessions"],
    queryFn: getQuizSessions,
  });

  const startMutation = useMutation({
    mutationFn: () => createQuizSession(mode, topic === SMART_WEIGHTED ? undefined : topic),
    onSuccess: (session) => router.push(`/study/${session.id}`),
    onError: (err: Error) => toast.error(err.message || "Failed to start session."),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteQuizSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quiz-sessions"] });
      toast.success("Session removed.");
    },
  });

  return (
    <>
      <TopBar title="Study Center" description="Practice with RAG-generated questions using text or voice" />
      <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Start a Session</CardTitle>
            <CardDescription>Pick a focus topic and answer mode</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label>Mode</Label>
              <Tabs value={mode} onValueChange={(v) => setMode(v as QuizMode)}>
                <TabsList className="w-full">
                  <TabsTrigger value="text" className="flex-1 gap-1.5">
                    <Type className="size-4" /> Text Quiz
                  </TabsTrigger>
                  <TabsTrigger value="viva" className="flex-1 gap-1.5">
                    <Mic className="size-4" /> Spoken Viva
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-2">
              <Label>Focus Topic</Label>
              <Select value={topic} onValueChange={(v) => setTopic(v ?? SMART_WEIGHTED)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SMART_WEIGHTED}>Smart Weighted (focuses on weak areas)</SelectItem>
                  {files?.map((f) => (
                    <SelectItem key={f.name} value={f.name}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="gap-2"
              disabled={startMutation.isPending}
              onClick={() => startMutation.mutate()}
            >
              <GraduationCap className="size-4" />
              {startMutation.isPending ? "Starting..." : "Start Session"}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Resume a Session</CardTitle>
            <CardDescription>Continue a past thread or review its transcript</CardDescription>
          </CardHeader>
          <CardContent>
            {sessionsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : !sessions?.length ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No study sessions yet. Start one to begin building history.
              </p>
            ) : (
              <ul className="divide-y">
                {sessions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                    <button
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      onClick={() => router.push(`/study/${s.id}`)}
                    >
                      {s.mode === "viva" ? (
                        <Mic className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <Type className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{s.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.topic ?? "Smart Weighted"} &middot; {new Date(s.updated_at).toLocaleString()}
                        </p>
                      </div>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => deleteMutation.mutate(s.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
