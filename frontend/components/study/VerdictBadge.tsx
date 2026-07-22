import { CheckCircle2, CircleAlert, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Verdict } from "@/lib/api/types";

const VERDICT_CONFIG: Record<
  Verdict,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  Correct: {
    label: "Correct",
    icon: CheckCircle2,
    className: "bg-verdict-correct/15 text-verdict-correct border-verdict-correct/30",
  },
  "Partially Correct": {
    label: "Partially Correct",
    icon: CircleAlert,
    className: "bg-verdict-partial/15 text-verdict-partial border-verdict-partial/30",
  },
  Incorrect: {
    label: "Incorrect",
    icon: XCircle,
    className: "bg-verdict-incorrect/15 text-verdict-incorrect border-verdict-incorrect/30",
  },
};

export function VerdictBadge({ verdict, className }: { verdict: Verdict; className?: string }) {
  const config = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG.Incorrect;
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium",
        config.className,
        className
      )}
    >
      <Icon className="size-4" />
      {config.label}
    </span>
  );
}
