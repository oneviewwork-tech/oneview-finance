import type { LucideIcon } from "lucide-react";
import { Sparkline } from "@/components/charts/sparkline";
import { DeltaPill, type KpiDelta } from "./kpi-card";

export interface HeroStat {
  label: string;
  value: string;
}

/**
 * The one number the dashboard leads with, plus a couple of supporting
 * stats and a trend line. Exactly one per view — a full-bleed gradient
 * card so it reads as "the headline," not just another tile in the grid.
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
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 shadow-lg shadow-indigo-600/20">
      <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-fuchsia-400/20 blur-3xl" />

      <div className="relative flex flex-col gap-5 p-6 text-white lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {Icon && (
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <Icon className="h-4 w-4" strokeWidth={2.25} />
              </span>
            )}
            <span className="text-[0.8125rem] font-semibold text-white/80">{label}</span>
          </div>
          <div className="mt-2.5 flex flex-wrap items-end gap-2.5">
            <span className="text-[2.5rem] font-extrabold leading-none tracking-[-0.02em] tabular-nums">{value}</span>
            {hasDelta && <DeltaPill percentChange={delta.percentChange} upIsGood={delta.upIsGood} />}
          </div>
          {(caption || (hasDelta && comparisonLabel)) && (
            <p className="mt-2 text-[0.8125rem] text-white/70">{hasDelta && comparisonLabel ? comparisonLabel : caption}</p>
          )}
        </div>

        <div className="flex items-center gap-6">
          {stats && stats.length > 0 && (
            <div className="flex gap-6">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl bg-white/10 px-3.5 py-2.5 backdrop-blur-sm">
                  <p className="text-[0.6875rem] font-medium text-white/70">{s.label}</p>
                  <p className="mt-0.5 text-[0.9375rem] font-bold tabular-nums">{s.value}</p>
                </div>
              ))}
            </div>
          )}
          {trend && trend.length > 1 && (
            <div className="hidden text-white/90 sm:block">
              <Sparkline values={trend} width={120} height={44} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
