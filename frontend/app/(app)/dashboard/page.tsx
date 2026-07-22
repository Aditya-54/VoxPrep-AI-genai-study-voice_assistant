"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Award, GraduationCap, ListChecks, Percent, Sparkles, TriangleAlert } from "lucide-react";

import { TopBar } from "@/components/layout/TopBar";
import { StatCard } from "@/components/shared/StatCard";
import { VerdictBadge } from "@/components/study/VerdictBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getStats } from "@/lib/api/stats";
import { cn } from "@/lib/utils";

function truncate(text: string, max = 28) {
  if (!text || text === "N/A") return "N/A";
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({ queryKey: ["stats"], queryFn: getStats });

  return (
    <>
      <TopBar title="Overview" description="Your study progress at a glance" />
      <div className="flex flex-col gap-6 p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px] rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Quizzes" value={stats?.total_attempts ?? 0} icon={ListChecks} tone="primary" />
            <StatCard label="Avg Accuracy" value={`${stats?.average_accuracy ?? 0}%`} icon={Percent} tone="correct" />
            <StatCard label="Needs Focus" value={truncate(stats?.weakest_topic ?? "N/A")} icon={TriangleAlert} tone="incorrect" />
            <StatCard label="Mastered Topic" value={truncate(stats?.strongest_topic ?? "N/A")} icon={Award} tone="default" />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent Attempts</CardTitle>
              <CardDescription>Your latest quiz and viva answers, most recent first</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : !stats?.recent_attempts?.length ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No attempts logged yet. Start a quiz in the Study Center to see activity here.
                </p>
              ) : (
                <ul className="divide-y">
                  {stats.recent_attempts.map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{a.question}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.source_file} &middot; Page {a.page_number}
                        </p>
                      </div>
                      <VerdictBadge verdict={a.verdict} className="shrink-0" />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Jump back into studying</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Link href="/study" className={cn(buttonVariants(), "justify-start gap-2")}>
                <GraduationCap className="size-4" /> Start a Study Session
              </Link>
              <Link href="/research" className={cn(buttonVariants({ variant: "secondary" }), "justify-start gap-2")}>
                <Sparkles className="size-4" /> Ask the Research Assistant
              </Link>
              <Link href="/library" className={cn(buttonVariants({ variant: "outline" }), "justify-start gap-2")}>
                <ListChecks className="size-4" /> Manage Study Library
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
