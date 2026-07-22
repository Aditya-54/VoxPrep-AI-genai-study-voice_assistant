import { apiGet } from "./client";
import type { StatsSummary, TimelinePoint } from "./types";

export function getStats(): Promise<StatsSummary> {
  return apiGet<StatsSummary>("/stats");
}

export function getStatsTimeline(): Promise<TimelinePoint[]> {
  return apiGet<TimelinePoint[]>("/stats/timeline");
}
