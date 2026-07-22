"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Award, ListChecks, Percent, TriangleAlert } from "lucide-react";

import { TopBar } from "@/components/layout/TopBar";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getStats, getStatsTimeline } from "@/lib/api/stats";

function accuracyColor(acc: number) {
  if (acc < 50) return "var(--color-verdict-incorrect)";
  if (acc < 75) return "var(--color-verdict-partial)";
  return "var(--color-verdict-correct)";
}

function truncate(text: string, max = 24) {
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

export default function AnalyticsPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({ queryKey: ["stats"], queryFn: getStats });
  const { data: timeline, isLoading: timelineLoading } = useQuery({
    queryKey: ["stats-timeline"],
    queryFn: getStatsTimeline,
  });

  const topicData = useMemo(() => {
    if (!stats?.topic_stats) return [];
    return [...stats.topic_stats]
      .sort((a, b) => a.accuracy - b.accuracy)
      .map((s) => ({ ...s, label: truncate(s.topic) }));
  }, [stats]);

  const trendData = useMemo(() => {
    if (!timeline?.length) return [];
    const window = 3;
    return timeline.map((point, i) => {
      const start = Math.max(0, i - window + 1);
      const slice = timeline.slice(start, i + 1);
      const rollingAvg = slice.reduce((sum, p) => sum + p.score * 100, 0) / slice.length;
      return {
        attempt: i + 1,
        score: point.score * 100,
        rollingAvg: Math.round(rollingAvg * 10) / 10,
      };
    });
  }, [timeline]);

  const isLoading = statsLoading || timelineLoading;

  return (
    <>
      <TopBar title="Analytics" description="Deeper performance trends across topics and time" />
      <div className="flex flex-col gap-6 p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px] rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Attempts" value={stats?.total_attempts ?? 0} icon={ListChecks} tone="primary" />
            <StatCard label="Avg Accuracy" value={`${stats?.average_accuracy ?? 0}%`} icon={Percent} tone="correct" />
            <StatCard label="Needs Focus" value={truncate(stats?.weakest_topic ?? "N/A")} icon={TriangleAlert} tone="incorrect" />
            <StatCard label="Mastered Topic" value={truncate(stats?.strongest_topic ?? "N/A")} icon={Award} tone="default" />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Accuracy by Topic</CardTitle>
              <CardDescription>Weakest topics surface at the top</CardDescription>
            </CardHeader>
            <CardContent>
              {!topicData.length ? (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  Not enough data yet. Complete a few quizzes first.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(240, topicData.length * 44)}>
                  <BarChart data={topicData} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={140}
                      tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(value) => [`${value}%`, "Accuracy"]}
                    />
                    <Bar dataKey="accuracy" radius={[0, 6, 6, 0]} barSize={18}>
                      {topicData.map((entry, i) => (
                        <Cell key={i} fill={accuracyColor(entry.accuracy)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Accuracy Over Time</CardTitle>
              <CardDescription>Rolling average (window of 3) across all attempts</CardDescription>
            </CardHeader>
            <CardContent>
              {trendData.length < 2 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  Need at least 2 attempts to plot a trend line.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={340}>
                  <ComposedChart data={trendData} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="attempt"
                      tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      label={{ value: "Attempt #", position: "insideBottom", offset: -4, fontSize: 11 }}
                    />
                    <YAxis domain={[-10, 110]} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Scatter dataKey="score" fill="var(--color-chart-2)" opacity={0.5} name="Individual Score" />
                    <Line
                      type="monotone"
                      dataKey="rollingAvg"
                      stroke="var(--color-chart-1)"
                      strokeWidth={2.5}
                      dot={false}
                      name="Rolling Avg"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
