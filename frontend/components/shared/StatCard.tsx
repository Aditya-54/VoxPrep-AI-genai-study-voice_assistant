import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "correct" | "incorrect" | "primary";
}) {
  const toneClasses: Record<string, string> = {
    default: "bg-muted text-muted-foreground",
    correct: "bg-verdict-correct/15 text-verdict-correct",
    incorrect: "bg-verdict-incorrect/15 text-verdict-incorrect",
    primary: "bg-primary/15 text-primary",
  };

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-2">
        <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", toneClasses[tone])}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-semibold tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
