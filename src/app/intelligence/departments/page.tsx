import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, ChevronRight, TrendingDown, TrendingUp, Trophy, Wallet } from "lucide-react";
import type { Currency } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { requireUser, canViewIntelligenceEntity } from "@/lib/rbac";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { parseRangeSelection, resolveSelection, describeSelectionLong } from "@/domain/finance/date-range";
import { listDepartmentCards, type DepartmentCard } from "@/services/finance/department-regional";
import { ensureTodayLiveRate } from "@/services/fx/exchange-rate.service";
import { EmptyState } from "@/components/ui/empty-state";
import { IntelligenceFilters } from "../filters";

/**
 * Department View — pick a team, then see it across both regions.
 *
 * Separate from the entity dashboards because a department is global: Social
 * Media sells in Dubai and Bangalore both, and judging it from one entity's
 * page answers half the question. The old Department Performance panel lived
 * on an entity dashboard and could only ever show that entity's slice.
 */
export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ currency?: string; range?: string; month?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();

  // Cross-entity by nature, so it needs the combined permission.
  if (!canViewIntelligenceEntity(user.role, "ALL")) notFound();

  const currency: Currency = params.currency === "AED" ? "AED" : "INR";
  const selection = parseRangeSelection(params);
  const range = resolveSelection(selection);
  const rangeLabel = describeSelectionLong(selection);

  await ensureTodayLiveRate();
  const departments = await listDepartmentCards(currency, range);

  const qs = new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string] => typeof e[1] === "string")
  );
  qs.set("currency", currency);

  const leaderboard = computeLeaderboard(departments);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-page-title">Department View</h1>
          <p className="mt-0.5 text-page-subtitle">
            Each team across UAE and India together, {rangeLabel}. Reported in {currency}.
          </p>
        </div>
        <IntelligenceFilters entity="ALL" currency={currency} selection={selection} showCurrency />
      </div>

      {/* The card grid below answers "how is department X doing" one at a
          time. This answers "which one, out of all of them" at a glance —
          a different question, and the one worth leading with. Excludes
          departments with nothing recorded and any whose combined figure is
          withheld for a missing FX rate: a leaderboard built from an
          incomparable or empty entry would be a false positive, not a
          finding. */}
      {leaderboard && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <LeaderboardCard
            label="Most Revenue"
            icon={Trophy}
            tone="success"
            entry={leaderboard.mostRevenue}
            value={formatMoney(leaderboard.mostRevenue.revenue!, currency)}
            qs={qs}
          />
          <LeaderboardCard
            label="Highest Spent"
            icon={Wallet}
            entry={leaderboard.highestSpent}
            value={formatMoney(leaderboard.highestSpent.spent!, currency)}
            qs={qs}
          />
          <LeaderboardCard
            label="Most Profitable"
            icon={TrendingUp}
            tone="success"
            entry={leaderboard.mostProfitable}
            value={formatMoney(leaderboard.mostProfitable.net!, currency)}
            qs={qs}
          />
          <LeaderboardCard
            label={leaderboard.needsAttention.net!.lt(0) ? "Needs Attention" : "Lowest Net"}
            icon={TrendingDown}
            tone={leaderboard.needsAttention.net!.lt(0) ? "destructive" : "default"}
            entry={leaderboard.needsAttention}
            value={formatMoney(leaderboard.needsAttention.net!, currency)}
            qs={qs}
          />
        </div>
      )}

      {departments.length === 0 ? (
        <EmptyState
          title="No departments yet"
          description="Create departments under Master Data, then tag them on inflow and outflow entries."
          actionLabel="Manage departments"
          actionHref="/operations/categories"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((d) => {
            const hasFigures = d.revenue !== null && d.spent !== null && d.net !== null;
            const positive = hasFigures && d.net!.gte(0);
            return (
              <Link
                key={d.id}
                href={`/intelligence/departments/${d.id}?${qs.toString()}`}
                className="group rounded-xl border border-border bg-card p-5 transition-ui hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                </div>

                <p className="mt-3 text-sm font-semibold">{d.name}</p>
                <p className="mt-0.5 text-metadata">
                  {d.entryCount === 0 ? "No entries this period" : `${d.entryCount} entries`}
                </p>

                {hasFigures ? (
                  <div className="mt-3 space-y-1.5 text-xs">
                    <Row label="Revenue" value={formatMoney(d.revenue!, currency)} className="text-success" />
                    <Row label="Spent" value={formatMoney(d.spent!, currency)} />
                    <Row
                      label="Net"
                      value={formatMoney(d.net!, currency)}
                      className={cn("font-medium", positive ? "text-success" : "text-destructive")}
                    />
                  </div>
                ) : (
                  // Withheld rather than guessed: one region's rate is
                  // missing, so a combined figure would be wrong, not partial.
                  <p className="mt-3 text-metadata">
                    Combined figures unavailable — an exchange rate is missing for this period.
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${className}`}>{value}</span>
    </div>
  );
}

/** A card with figures resolved (never null), for the leaderboard slots. */
type RankedCard = DepartmentCard & { revenue: Prisma.Decimal; spent: Prisma.Decimal; net: Prisma.Decimal };

function computeLeaderboard(
  departments: DepartmentCard[]
): { mostRevenue: RankedCard; highestSpent: RankedCard; mostProfitable: RankedCard; needsAttention: RankedCard } | null {
  const ranked = departments.filter(
    (d): d is RankedCard => d.revenue !== null && d.spent !== null && d.net !== null && d.entryCount > 0
  );
  // Two departments can't be "the most" of anything, and the four slots
  // below would otherwise repeat the same single row four times.
  if (ranked.length < 2) return null;

  const top = (by: (d: RankedCard) => Prisma.Decimal, dir: 1 | -1) =>
    [...ranked].sort((a, b) => by(b).comparedTo(by(a)) * dir)[0];

  return {
    mostRevenue: top((d) => d.revenue, 1),
    highestSpent: top((d) => d.spent, 1),
    mostProfitable: top((d) => d.net, 1),
    needsAttention: top((d) => d.net, -1),
  };
}

function LeaderboardCard({
  label,
  icon: Icon,
  entry,
  value,
  qs,
  tone = "default",
}: {
  label: string;
  icon: typeof Trophy;
  entry: RankedCard;
  value: string;
  qs: URLSearchParams;
  tone?: "default" | "success" | "destructive";
}) {
  return (
    <Link
      href={`/intelligence/departments/${entry.id}?${qs.toString()}`}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-ui hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          tone === "success" ? "bg-success-subtle text-success" : tone === "destructive" ? "bg-destructive-subtle text-destructive" : "bg-brand-subtle text-brand"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-metadata">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold">{entry.name}</p>
        <p
          className={cn(
            "mt-0.5 text-sm tabular-nums",
            tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {value}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
