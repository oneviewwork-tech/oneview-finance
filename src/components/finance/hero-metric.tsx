import type { LucideIcon } from "lucide-react";
import { Sparkline } from "@/components/charts/sparkline";
import { DeltaPill, type KpiDelta } from "./kpi-card";

export interface HeroStat {
  label: string;
  value: string;
}

/**
 * The one number the dashboard leads with, plus a couple of supporting
 * stats and a trend line. Exactly one per view.
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
  const hasDelta = delta && delta.percentChange !== null && delta.percentChange !== undefined;

  return (
    <div className="relative overflow-hidden rounded-lg border border-brand/20 bg-card shadow-xs">
      {/* Soft brand wash, kept low-contrast so the number stays the loudest thing. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/[0.07] via-transparent to-transparent" />
      <div className="relative flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {Icon && (
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-subtle text-brand">
                <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
            )}
            <span className="text-card-title">{label}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-2.5">
            <span className="text-[2.25rem] font-semibold leading-none tracking-[-0.02em]">{value}</span>
            {hasDelta && <DeltaPill percentChange={delta.percentChange} upIsGood={delta.upIsGood} />}
          </div>
          {(caption || (hasDelta && comparisonLabel)) && (
            <p className="mt-2 text-metadata">{hasDelta && comparisonLabel ? comparisonLabel : caption}</p>
          )}
        </div>

        <div className="flex items-center gap-6">
          {stats && stats.length > 0 && (
            <div className="flex gap-6">
              {stats.map((s) => (
                <div key={s.label}>
                  <p className="text-metadata">{s.label}</p>
                  <p className="mt-0.5 text-metric-sm">{s.value}</p>
                </div>
              ))}
            </div>
          )}
          {trend && trend.length > 1 && (
            <div className="hidden text-brand sm:block">
              <Sparkline values={trend} width={120} height={44} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
