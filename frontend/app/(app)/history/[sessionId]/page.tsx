"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, PlayCircle } from "lucide-react";

import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VerdictBadge } from "@/components/study/VerdictBadge";
import { getQuizSession } from "@/lib/api/quiz";
import { cn } from "@/lib/utils";

export default function HistorySessionPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = Number(params.sessionId);

  const { data: session, isLoading } = useQuery({
    queryKey: ["quiz-session", sessionId],
    queryFn: () => getQuizSession(sessionId),
    enabled: Number.isFinite(sessionId),
  });

  return (
    <>
      <TopBar title={session?.title ?? "Session Transcript"} description={session?.topic ?? undefined} />
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <Link href="/history" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}>
            <ArrowLeft className="size-4" /> Back to History
          </Link>
          {session && (
            <Link
              href={`/study/${session.id}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <PlayCircle className="size-4" /> Continue this session
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : !session?.attempts.length ? (
          <p className="py-14 text-center text-sm text-muted-foreground">
            No questions were answered in this session yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {session.attempts.map((a) => (
              <Card key={a.id}>
                <CardContent className="space-y-2 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">{a.question}</p>
                    <VerdictBadge verdict={a.verdict} className="shrink-0" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Your answer: </span>
                    {a.user_answer}
                  </p>
                  <p className="text-sm text-muted-foreground">{a.explanation}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {a.source_file} &middot; Page {a.page_number}
                  </p>
                </CardContent>
              </Card>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
