import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/charts/sparkline";
import type { KpiDelta } from "./kpi-card";

export interface HeroStat {
  label: string;
  value: string;
}

/**
 * The one number the dashboard leads with, plus a couple of supporting
 * stats and a trend line. Exactly one per view — a plain, calm card (not a
 * loud gradient) so it reads as "the headline" through hierarchy and size,
 * the same surface language as everything else on the page.
 */
export function HeroMetric({
  label,
  value,
  caption,
  delta,
  comparisonLabel,
  trend,
  stats,
  icon: Icon,
}: {
  label: string;
  value: string;
  caption?: string;
  delta?: KpiDelta;
  comparisonLabel?: string;
  trend?: number[];
  stats?: HeroStat[];
  icon?: LucideIcon;
}) {
  const deltaValue = delta?.percentChange;
  const hasDelta = deltaValue !== null && deltaValue !== undefined;
  const deltaPositive = hasDelta && deltaValue >= 0;
  const deltaGood = deltaPositive === delta?.upIsGood;
  const deltaColor = !hasDelta ? "text-muted-foreground" : deltaGood ? "text-success" : "text-destructive";
  const DeltaIcon = deltaPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="rounded-xl border border-border bg-card p-6 lg:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {Icon && (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-subtle">
                <Icon className="h-5 w-5 text-brand" />
              </div>
            )}
            <span className="text-label uppercase tracking-wider text-muted-foreground">{label}</span>
          </div>

          <div className="mt-4 flex flex-wrap items-baseline gap-3">
            <span className="text-metric text-foreground">{value}</span>
            {hasDelta && (
              <span className={cn("inline-flex items-center gap-0.5 text-sm font-medium", deltaColor)}>
                <DeltaIcon className="h-4 w-4" />
                {Math.abs(deltaValue * 100).toFixed(1)}%
                {comparisonLabel && <span className="ml-1 font-normal text-muted-foreground">vs {comparisonLabel}</span>}
              </span>
            )}
          </div>

          {caption && <p className="mt-1.5 text-sm text-muted-foreground">{caption}</p>}

          {stats && stats.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
              {stats.map((s) => (
                <div key={s.label}>
                  <p className="text-metadata">{s.label}</p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground">{s.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {trend && trend.length > 1 && (
          <div className="hidden shrink-0 text-brand sm:block">
            <Sparkline values={trend} width={120} height={44} />
          </div>
        )}
      </div>
    </div>
  );
}
