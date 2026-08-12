import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TrendBadgeProps {
  /** Fractional change, e.g. 0.084 for +8.4%. Pass null/undefined to render nothing — never fabricate a comparison the data doesn't support. */
  percentChange: number | null | undefined;
  /** true when an increase is the good direction for this metric (Inflow); false when a decrease is good (Outflow Pending). */
  upIsGood: boolean;
  className?: string;
}

/** A small, non-decorative trend indicator — never a giant colored arrow, just enough signal to read at a glance. */
export function TrendBadge({ percentChange, upIsGood, className }: TrendBadgeProps) {
  if (percentChange === null || percentChange === undefined) return null;

  const isFlat = Math.abs(percentChange) < 0.0005;
  const isUp = percentChange > 0;
  const isGood = isFlat ? null : isUp === upIsGood;
  const Icon = isFlat ? Minus : isUp ? ArrowUp : ArrowDown;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-label font-medium tabular-nums",
        isFlat ? "text-muted-foreground" : isGood ? "text-success" : "text-destructive",
        className
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      {Math.abs(percentChange * 100).toFixed(1)}%
    </span>
  );
}
