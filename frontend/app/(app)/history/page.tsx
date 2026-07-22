"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { History as HistoryIcon, Mic, Type } from "lucide-react";

import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getQuizSessions } from "@/lib/api/quiz";

export default function HistoryPage() {
  const { data: sessions, isLoading } = useQuery({ queryKey: ["quiz-sessions"], queryFn: getQuizSessions });

  return (
    <>
      <TopBar title="Study History" description="Browse past quiz and viva session transcripts" />
      <div className="p-6">
        <Card>
          <CardContent className="py-4">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : !sessions?.length ? (
              <div className="flex flex-col items-center gap-2 py-14 text-center text-sm text-muted-foreground">
                <HistoryIcon className="size-6" />
                No study sessions yet. Start one from the Study Center.
              </div>
            ) : (
              <ul className="divide-y">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/history/${s.id}`}
                      className="flex items-center justify-between gap-3 py-3 hover:bg-muted/40"
                    >
                      <div className="flex min-w-0 items-center gap-3">
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
                      </div>
                      <Badge variant="outline" className="shrink-0 capitalize">
                        {s.mode}
                      </Badge>
                    </Link>
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
