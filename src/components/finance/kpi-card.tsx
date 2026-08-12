import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkline } from "@/components/charts/sparkline";

export interface KpiDelta {
  percentChange: number | null | undefined;
  upIsGood: boolean;
}

export type KpiTone = "default" | "success" | "warning" | "destructive" | "brand";

const TONE_CHIP: Record<KpiTone, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  destructive: "bg-destructive-subtle text-destructive",
  brand: "bg-brand-subtle text-brand",
};

/** Compact delta pill that sits beside the value, matching the reference pattern. */
export function DeltaPill({ percentChange, upIsGood }: KpiDelta) {
  if (percentChange === null || percentChange === undefined) return null;
  const isFlat = Math.abs(percentChange) < 0.0005;
  if (isFlat) return null;
  const isUp = percentChange > 0;
  const isGood = isUp === upIsGood;
  const Icon = isUp ? ArrowUp : ArrowDown;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums",
        isGood ? "bg-success-subtle text-success" : "bg-destructive-subtle text-destructive"
      )}
    >
      <Icon className="h-2.5 w-2.5" strokeWidth={3} />
      {Math.abs(percentChange * 100).toFixed(1)}%
    </span>
  );
}

const TONE_TEXT: Record<KpiTone, string> = {
  default: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  brand: "text-brand",
};

export interface KpiCardProps {
  label: string;
  value: string;
  sublabel?: string;
  delta?: KpiDelta;
  comparisonLabel?: string;
  icon?: LucideIcon;
  tone?: KpiTone;
  href?: string;
  /** Optional supporting trend, rendered as a small sparkline. */
  trend?: number[];
  /** Optional 0..1 progress meter, for ratio metrics like % settled. */
  progress?: number;
}

export function KpiCard({
  label,
  value,
  sublabel,
  delta,
  comparisonLabel,
  icon: Icon,
  tone = "default",
  href,
  trend,
  progress,
}: KpiCardProps) {
  const hasDelta = delta && delta.percentChange !== null && delta.percentChange !== undefined;

  const body = (
    <CardContent className="pt-4">
      <div className="flex items-center gap-2">
        {Icon && (
          <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", TONE_CHIP[tone])}>
            <Icon className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
        )}
        <span className="text-card-title truncate">{label}</span>
      </div>

      <div className="mt-2.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-metric">{value}</span>
            {hasDelta && <DeltaPill percentChange={delta.percentChange} upIsGood={delta.upIsGood} />}
          </div>
          {(hasDelta && comparisonLabel) || sublabel ? (
            <p className="mt-1 truncate text-metadata">{hasDelta && comparisonLabel ? comparisonLabel : sublabel}</p>
          ) : null}
        </div>
        {trend && trend.length > 1 && (
          <div className={cn("shrink-0", TONE_TEXT[tone])}>
            <Sparkline values={trend} width={72} height={26} />
          </div>
        )}
      </div>

      {progress !== undefined && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-ui",
              tone === "warning" ? "bg-warning" : tone === "destructive" ? "bg-destructive" : "bg-success"
            )}
            style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }}
          />
        </div>
      )}
    </CardContent>
  );

  if (href) {
    return (
      <Card interactive className="p-0">
        <Link href={href} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {body}
        </Link>
      </Card>
    );
  }

  return <Card className="p-0">{body}</Card>;
}
