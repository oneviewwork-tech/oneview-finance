import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/charts/sparkline";

export interface KpiDelta {
  percentChange: number | null | undefined;
  upIsGood: boolean;
}

export type KpiTone = "default" | "success" | "warning" | "destructive" | "brand";

const TONE_CLASSES: Record<KpiTone, { value: string; iconBg: string; progressBar: string; sparkline: string }> = {
  default: { value: "text-foreground", iconBg: "bg-secondary text-muted-foreground", progressBar: "bg-primary", sparkline: "text-muted-foreground" },
  success: { value: "text-success", iconBg: "bg-success-subtle text-success", progressBar: "bg-success", sparkline: "text-success" },
  warning: { value: "text-warning", iconBg: "bg-warning-subtle text-warning", progressBar: "bg-warning", sparkline: "text-warning" },
  destructive: { value: "text-destructive", iconBg: "bg-destructive-subtle text-destructive", progressBar: "bg-destructive", sparkline: "text-destructive" },
  brand: { value: "text-brand", iconBg: "bg-brand-subtle text-brand", progressBar: "bg-brand", sparkline: "text-brand" },
};

export interface KpiCardProps {
  label: string;
  value: string;
  sublabel?: string;
  icon?: LucideIcon;
  tone?: KpiTone;
  delta?: KpiDelta;
  comparisonLabel?: string;
  trend?: number[];
  progress?: number;
  href?: string;
}

export function KpiCard({
  label,
  value,
  sublabel,
  icon: Icon,
  tone = "default",
  delta,
  comparisonLabel,
  trend,
  progress,
  href,
}: KpiCardProps) {
  const styles = TONE_CLASSES[tone];
  const deltaValue = delta?.percentChange;
  const hasDelta = deltaValue !== null && deltaValue !== undefined;
  const deltaPositive = hasDelta && deltaValue >= 0;
  const deltaGood = deltaPositive === delta?.upIsGood;
  const deltaColor = !hasDelta ? "text-muted-foreground" : deltaGood ? "text-success" : "text-destructive";
  const DeltaIcon = deltaPositive ? ArrowUpRight : ArrowDownRight;

  const content = (
    <div className="flex h-full flex-col justify-between">
      <div className="flex items-start justify-between gap-2">
        {Icon && (
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", styles.iconBg)}>
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div className="flex items-center gap-1.5">
          {hasDelta && (
            <div className={cn("flex items-center gap-0.5 text-xs font-medium", deltaColor)}>
              <DeltaIcon className="h-3 w-3" />
              {Math.abs(deltaValue * 100).toFixed(1)}%
            </div>
          )}
          {/* Only on drill-down tiles — signals there's something behind the
              number, and slides on hover to confirm it's live. */}
          {href && (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
          )}
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          {/* Proportional figures — a stat-tile value is a standalone number,
              not a column of them. */}
          <p className={cn("text-metric-sm tracking-tight proportional-nums", styles.value)}>{value}</p>
          <p className="mt-0.5 truncate text-label text-muted-foreground">{label}</p>
          {sublabel && <p className="mt-0.5 truncate text-metadata">{sublabel}</p>}
          {comparisonLabel && hasDelta && <p className="mt-1 text-metadata">vs {comparisonLabel}</p>}
        </div>
        {trend && trend.length > 1 && (
          <div className={cn("shrink-0", styles.sparkline)}>
            <Sparkline values={trend} width={56} height={22} />
          </div>
        )}
      </div>

      {progress !== undefined && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all duration-500", styles.progressBar)}
              style={{ width: `${Math.min(Math.max(progress * 100, 0), 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="h-full rounded-xl border border-border bg-card p-5 transition-ui hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md">
          {content}
        </div>
      </Link>
    );
  }

  return <div className="h-full rounded-xl border border-border bg-card p-5">{content}</div>;
}
