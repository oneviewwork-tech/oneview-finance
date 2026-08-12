import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/charts/sparkline";

export interface KpiDelta {
  percentChange: number | null | undefined;
  upIsGood: boolean;
}

export type KpiTone = "default" | "success" | "warning" | "destructive" | "brand";

/**
 * Finance View's palette: clean white/neutral card surfaces (premium SaaS
 * dashboard look — not a tinted background per card), with color carried
 * entirely by the solid-fill icon badge, the sparkline, and the progress
 * bar. Card surface stays the same across tones; only the accent changes.
 */
const TONE_STYLES: Record<KpiTone, { iconBg: string; progressBar: string; sparkline: string }> = {
  success: { iconBg: "bg-emerald-500", progressBar: "bg-emerald-500", sparkline: "text-emerald-500" },
  warning: { iconBg: "bg-amber-500", progressBar: "bg-amber-500", sparkline: "text-amber-500" },
  destructive: { iconBg: "bg-rose-500", progressBar: "bg-rose-500", sparkline: "text-rose-500" },
  brand: { iconBg: "bg-violet-600", progressBar: "bg-violet-600", sparkline: "text-violet-600" },
  default: { iconBg: "bg-sky-500", progressBar: "bg-sky-500", sparkline: "text-sky-500" },
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
        "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.6875rem] font-bold tabular-nums text-white",
        isGood ? "bg-emerald-500" : "bg-rose-500"
      )}
    >
      <Icon className="h-2.5 w-2.5" strokeWidth={3} />
      {Math.abs(percentChange * 100).toFixed(1)}%
    </span>
  );
}

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
  const styles = TONE_STYLES[tone];

  const body = (
    <div className="p-4">
      <div className="flex items-center gap-2.5">
        {Icon && (
          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-sm", styles.iconBg)}>
            <Icon className="h-4 w-4" strokeWidth={2.25} />
          </span>
        )}
        <span className="truncate text-[0.8125rem] font-semibold text-foreground/70">{label}</span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[1.5rem] font-extrabold leading-none tracking-[-0.02em] tabular-nums">{value}</span>
            {hasDelta && <DeltaPill percentChange={delta.percentChange} upIsGood={delta.upIsGood} />}
          </div>
          {(hasDelta && comparisonLabel) || sublabel ? (
            <p className="mt-1.5 truncate text-[0.75rem] text-foreground/55">
              {hasDelta && comparisonLabel ? comparisonLabel : sublabel}
            </p>
          ) : null}
        </div>
        {trend && trend.length > 1 && (
          <div className={cn("shrink-0", styles.sparkline)}>
            <Sparkline values={trend} width={64} height={24} />
          </div>
        )}
      </div>

      {progress !== undefined && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
          <div
            className={cn("h-full rounded-full transition-ui", styles.progressBar)}
            style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }}
          />
        </div>
      )}
    </div>
  );

  const cardClassName = cn(
    "rounded-2xl border border-border bg-card shadow-sm transition-ui",
    href && "hover:-translate-y-0.5 hover:shadow-md"
  );

  if (href) {
    return (
      <div className={cardClassName}>
        <Link href={href} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {body}
        </Link>
      </div>
    );
  }

  return <div className={cardClassName}>{body}</div>;
}
