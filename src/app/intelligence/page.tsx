import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Clock,
  HandCoins,
  PieChart,
  Scale,
  TrendingDown,
  TrendingUp,
  Timer,
  Users,
  Wallet,
} from "lucide-react";
import { redirect } from "next/navigation";
import type { Currency } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, canViewIntelligenceEntity, defaultIntelligenceEntity, canAccessOperations } from "@/lib/rbac";
import { formatMoney, formatPercent } from "@/lib/format";
import { entitySlug } from "@/lib/entities";
import {
  previousPeriod,
  parseRangeSelection,
  resolveSelection,
  describeSelectionLong,
} from "@/domain/finance/date-range";
import { calculatePeriodChange } from "@/domain/finance/comparison";
import {
  getCategorySummary,
  getDashboardOverview,
  getInflowSummary,
  getMonthlySummary,
  getReceivables,
  getWeeklySummary,
} from "@/services/finance/summary";
import { getCombinedSummary, getFxBannerContext } from "@/services/finance/combined";
import { getAlerts } from "@/services/finance/alerts";
import { getSalarySummary, getProfitability, getPaymentLag } from "@/services/finance/profitability";
import { lossMargin, profitMargin } from "@/domain/finance/profitability";
import { AlertsPanel } from "@/components/finance/alerts-panel";
import { ensureTodayLiveRate } from "@/services/fx/exchange-rate.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/finance/kpi-card";
import { HeroMetric } from "@/components/finance/hero-metric";
import { DonutChart } from "@/components/charts/donut-chart";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { WeeklyOutflowChart } from "@/components/charts/weekly-outflow-chart";
import { EntityComparisonChart } from "@/components/charts/entity-comparison-chart";
import { STATUS_CHART_COLORS } from "@/lib/chart-palette";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/badge";
import { IntelligenceFilters } from "./filters";
import { FxBanner } from "./fx-banner";
import { CombinedConversionSummary } from "./combined-conversion-summary";


function pct(current: unknown, previous: unknown): number | null {
  const c = current as import("@prisma/client").Prisma.Decimal;
  const p = previous as import("@prisma/client").Prisma.Decimal;
  return calculatePeriodChange(c, p).percentChange?.toNumber() ?? null;
}

export default async function IntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{
    entity?: string;
    currency?: string;
    range?: string;
    month?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const entity = params.entity === "UAE" || params.entity === "INDIA" ? params.entity : "ALL";
  if (!canViewIntelligenceEntity(user.role, entity)) {
    const fallback = defaultIntelligenceEntity(user.role);
    const qs = new URLSearchParams(
      Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string")
    );
    qs.set("entity", fallback);
    redirect(`/intelligence?${qs.toString()}`);
  }
  const selection = parseRangeSelection(params);
  const range = resolveSelection(selection);
  const rangeLabel = describeSelectionLong(selection);
  const previousRange = previousPeriod(range);
  const comparisonLabel = `vs previous period`;

  if (entity === "ALL") {
    const currency: Currency = params.currency === "AED" ? "AED" : "INR";
    await ensureTodayLiveRate();

    const [combined, previousCombined, fxContext] = await Promise.all([
      getCombinedSummary(currency, range),
      getCombinedSummary(currency, previousRange),
      getFxBannerContext(range.to),
    ]);

    const c = combined.combined;
    const prev = previousCombined.combined;

    // Combined tiles drill into a per-entity breakdown rather than one
    // entity's rows: these totals span UAE and India, so linking to a single
    // entity's list would misrepresent the number. Current filters ride along
    // so the breakdown shows the same period and reporting currency.
    const breakdownHref = (metric: string) => {
      const qs = new URLSearchParams(
        Object.entries(params).filter((e): e is [string, string] => typeof e[1] === "string")
      );
      qs.set("metric", metric);
      qs.set("currency", currency);
      return `/intelligence/breakdown?${qs.toString()}`;
    };

    return (
      <div className="space-y-6">
        <PageHeader
          title="Finance View"
          subtitle={`India + UAE combined performance, ${rangeLabel}`}
          controls={<IntelligenceFilters entity={entity} currency={currency} selection={selection} showCurrency />}
        />

        <FxBanner context={fxContext} />

        {!c.available ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Combined totals cannot be shown for this period because an exchange rate is missing. See the banner above.
            </CardContent>
          </Card>
        ) : (
          <>
            <HeroMetric
              label="Combined Net Position"
              value={formatMoney(c.netPosition, currency)}
              caption={`Inflow received minus outflow paid, reported in ${currency}`}
              icon={Scale}
              delta={prev.available ? { percentChange: pct(c.netPosition, prev.netPosition), upIsGood: true } : undefined}
              comparisonLabel={comparisonLabel}
              stats={[
                { label: "Inflow received", value: formatMoney(c.totalInflow, currency) },
                { label: "Outflow paid", value: formatMoney(c.outflowPaid, currency) },
              ]}
            />

            <CombinedConversionSummary result={combined} currency={currency} />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <KpiCard
                label="Total Inflow Received"
                value={formatMoney(c.totalInflow, currency)}
                icon={ArrowDownToLine}
                tone="success"
                delta={prev.available ? { percentChange: pct(c.totalInflow, prev.totalInflow), upIsGood: true } : undefined}
                comparisonLabel={comparisonLabel}
                href={breakdownHref("totalInflow")}
              />
              <KpiCard
                label="Total Outflow Due"
                value={formatMoney(c.totalOutflowDue, currency)}
                icon={ArrowUpFromLine}
                delta={prev.available ? { percentChange: pct(c.totalOutflowDue, prev.totalOutflowDue), upIsGood: false } : undefined}
                comparisonLabel={comparisonLabel}
                href={breakdownHref("totalOutflowDue")}
              />
              <KpiCard
                label="Outflow Paid"
                value={formatMoney(c.outflowPaid, currency)}
                icon={CheckCircle2}
                tone="success"
                progress={c.totalOutflowDue.gt(0) ? c.outflowPaid.toNumber() / c.totalOutflowDue.toNumber() : 0}
                sublabel="of total outflow due"
                href={breakdownHref("outflowPaid")}
              />
              <KpiCard
                label="Outflow Pending"
                value={formatMoney(c.outflowPending, currency)}
                icon={Clock}
                tone="warning"
                delta={prev.available ? { percentChange: pct(c.outflowPending, prev.outflowPending), upIsGood: false } : undefined}
                comparisonLabel={comparisonLabel}
                href={breakdownHref("outflowPending")}
              />
              <KpiCard
                label="Salary Paid"
                value={formatMoney(c.salaryPaid, currency)}
                icon={Wallet}
                sublabel={
                  c.outflowPaid.gt(0)
                    ? `${((c.salaryPaid.toNumber() / c.outflowPaid.toNumber()) * 100).toFixed(0)}% of all spend`
                    : undefined
                }
                delta={prev.available ? { percentChange: pct(c.salaryPaid, prev.salaryPaid), upIsGood: false } : undefined}
                comparisonLabel={comparisonLabel}
                href={breakdownHref("salaryPaid")}
              />
              <KpiCard
                label="Receivables"
                value={formatMoney(c.receivables, currency)}
                sublabel="Still owed by clients"
                icon={HandCoins}
                tone="warning"
                href={breakdownHref("receivables")}
              />
              <KpiCard
                label="Clients Closed"
                value={String(c.clientsClosed)}
                icon={Users}
                tone="brand"
                sublabel="Deals recorded this period"
                href={breakdownHref("clientsClosed")}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>UAE vs India</CardTitle>
              </CardHeader>
              <CardContent>
                <EntityComparisonChart
                  entityCodes={combined.rows.map((r) => r.native.entityCode)}
                  metrics={[
                    {
                      label: "Inflow",
                      values: combined.rows.map((r) => ({
                        entityCode: r.native.entityCode,
                        value: r.converted.totalInflow.toNumber(),
                        formattedValue: formatMoney(r.converted.totalInflow, currency),
                      })),
                    },
                    {
                      label: "Outflow Paid",
                      values: combined.rows.map((r) => ({
                        entityCode: r.native.entityCode,
                        value: r.converted.outflowPaid.toNumber(),
                        formattedValue: formatMoney(r.converted.outflowPaid, currency),
                      })),
                    },
                    {
                      label: "Net Position",
                      values: combined.rows.map((r) => ({
                        entityCode: r.native.entityCode,
                        value: r.converted.netPosition.toNumber(),
                        formattedValue: formatMoney(r.converted.netPosition, currency),
                      })),
                    },
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>UAE · India · Combined</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-table">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="py-2 font-medium">Metric</th>
                      {combined.rows.map((r) => (
                        <th key={r.native.entityCode} className="py-2 text-right font-medium">
                          {r.native.entityCode} ({r.native.currency})
                        </th>
                      ))}
                      <th className="py-2 text-right font-medium">Combined ({currency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {(
                      [
                        ["Inflow", "totalInflow"],
                        ["Outflow Due", "totalOutflowDue"],
                        ["Paid", "outflowPaid"],
                        ["Pending", "outflowPending"],
                        ["Receivables", "receivables"],
                        ["Net Position", "netPosition"],
                      ] as const
                    ).map(([label, key]) => (
                      <tr key={key} className="hover:bg-accent/40">
                        <td className="py-2 text-muted-foreground">{label}</td>
                        {combined.rows.map((r) => (
                          <td key={r.native.entityCode} className="py-2 text-right">
                            {formatMoney(r.native[key], r.native.currency as Currency)}
                          </td>
                        ))}
                        <td className="py-2 text-right font-medium">{formatMoney(c[key], currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <div className="flex gap-4 text-label font-medium">
              <Link href="/operations/uae" className="text-brand transition-ui hover:underline">
                View UAE Operations →
              </Link>
              <Link href="/operations/india" className="text-brand transition-ui hover:underline">
                View India Operations →
              </Link>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Single-entity dashboard (UAE / India), always in native currency ──
  const businessEntity = await prisma.businessEntity.findUniqueOrThrow({ where: { code: entity } });
  const slug = entitySlug(entity);

  // Tiles link into the records behind their number — but only for roles that
  // can actually open Accounts. A Management Viewer has no access there, so
  // for them the tiles stay plain rather than dangling a link that dead-ends.
  const opsHref = (path: string) => (canAccessOperations(user.role) ? path : undefined);

  // Carries entity and period across, so a detail page opens on exactly the
  // view whose number was clicked rather than resetting to this month.
  const insightHref = (insight: string) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter((e): e is [string, string] => typeof e[1] === "string")
    );
    qs.set("insight", insight);
    qs.set("entity", entity);
    return `/intelligence/insight?${qs.toString()}`;
  };
  const currency = businessEntity.baseCurrency;

  const [
    overview,
    previousOverview,
    categorySummary,
    weeklySummary,
    receivables,
    monthly,
    inflowSummary,
    alerts,
    salary,
    profitability,
    paymentLag,
  ] =
    await Promise.all([
      getDashboardOverview(businessEntity.id, range),
      getDashboardOverview(businessEntity.id, previousRange),
      getCategorySummary(businessEntity.id, range),
      getWeeklySummary(businessEntity.id, range),
      getReceivables(businessEntity.id, range),
      getMonthlySummary(businessEntity.id),
      getInflowSummary(businessEntity.id, range),
      // Not range-scoped on purpose — see getAlerts().
      getAlerts(businessEntity.id),
      getSalarySummary(businessEntity.id, range),
      getProfitability(businessEntity.id, range),
      getPaymentLag(businessEntity.id, range),
    ]);

  // Trend is deliberately NOT scoped to the selected range: a cash-flow
  // trend needs several months of context to mean anything, and the range
  // filter would usually collapse it to a single point.
  const cashFlowPoints = monthly.slice(-12).map((m) => {
    const [year, month] = m.monthKey.split("-");
    const label = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(
      new Date(Date.UTC(Number(year), Number(month) - 1, 1))
    );
    return {
      label,
      inflow: m.totalInflow.toNumber(),
      outflow: m.outflowPaid.toNumber(),
      formattedInflow: formatMoney(m.totalInflow, currency),
      formattedOutflow: formatMoney(m.outflowPaid, currency),
      formattedNet: formatMoney(m.netPosition, currency),
    };
  });

  const categoriesWithActivity = categorySummary.filter((c) => c.totalDue.gt(0)).sort((a, b) => b.totalDue.comparedTo(a.totalDue));
  const largestCategoryDue = categoriesWithActivity[0]?.totalDue.toNumber() ?? 0;

  const statusSegments = weeklySummary.byStatus.map((s) => ({
    label: s.status,
    value: s.items,
    color: STATUS_CHART_COLORS[s.status],
    formattedValue: `${s.items} item${s.items === 1 ? "" : "s"}`,
  }));

  const netTrend = monthly.slice(-6).map((m) => m.netPosition.toNumber());
  const inflowTrend = monthly.slice(-6).map((m) => m.totalInflow.toNumber());
  const outflowTrend = monthly.slice(-6).map((m) => m.outflowPaid.toNumber());
  const pendingTrend = monthly.slice(-6).map((m) => m.outflowPending.toNumber());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance View"
        subtitle={`${businessEntity.name} · ${currency} financial performance ${rangeLabel}`}
        controls={<IntelligenceFilters entity={entity} currency={currency} selection={selection} showCurrency={false} />}
      />

      <HeroMetric
        label="Net Position"
        value={formatMoney(overview.netPosition, currency)}
        caption="Inflow received minus outflow paid"
        icon={Scale}
        delta={{ percentChange: pct(overview.netPosition, previousOverview.netPosition), upIsGood: true }}
        comparisonLabel={comparisonLabel}
        trend={netTrend}
        stats={[
          { label: "Inflow received", value: formatMoney(overview.totalInflowReceived, currency) },
          { label: "Outflow paid", value: formatMoney(overview.outflowPaid, currency) },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <KpiCard
          label="Total Inflow (Received)"
          value={formatMoney(overview.totalInflowReceived, currency)}
          icon={ArrowDownToLine}
          tone="success"
          trend={inflowTrend}
          delta={{ percentChange: pct(overview.totalInflowReceived, previousOverview.totalInflowReceived), upIsGood: true }}
          comparisonLabel={comparisonLabel}
          href={opsHref(`/operations/${slug}/inflow/all`)}
        />
        <KpiCard
          label="Total Outflow (Due)"
          value={formatMoney(overview.totalOutflowDue, currency)}
          icon={ArrowUpFromLine}
          tone="brand"
          trend={outflowTrend}
          delta={{ percentChange: pct(overview.totalOutflowDue, previousOverview.totalOutflowDue), upIsGood: false }}
          comparisonLabel={comparisonLabel}
          href={opsHref(`/operations/${slug}/outflow/all`)}
        />
        <KpiCard
          label="Liabilities"
          value={formatMoney(overview.outflowPending, currency)}
          sublabel="Pending outflow — amount owed"
          icon={Clock}
          tone="warning"
          trend={pendingTrend}
          delta={{ percentChange: pct(overview.outflowPending, previousOverview.outflowPending), upIsGood: false }}
          comparisonLabel={comparisonLabel}
          href={opsHref(`/operations/${slug}/outflow/all?status=unpaid`)}
        />
        <KpiCard
          label="% Outflow Settled"
          value={formatPercent(overview.percentOutflowSettled)}
          icon={CheckCircle2}
          tone="success"
          progress={overview.percentOutflowSettled.toNumber()}
          sublabel={`${formatMoney(overview.outflowPaid, currency)} settled`}
          href={opsHref(`/operations/${slug}/outflow/all?status=PAID`)}
        />
        <KpiCard
          label="Receivables"
          value={formatMoney(overview.receivables, currency)}
          sublabel="Still owed by clients"
          icon={HandCoins}
          tone="warning"
          href={opsHref(`/operations/${slug}/inflow/all?status=unpaid`)}
        />
        <KpiCard
          label="Clients Closed"
          value={String(overview.clientsClosed)}
          icon={Users}
          tone="brand"
          delta={{
            percentChange:
              previousOverview.clientsClosed === 0
                ? null
                : (overview.clientsClosed - previousOverview.clientsClosed) / previousOverview.clientsClosed,
            upIsGood: true,
          }}
          comparisonLabel={comparisonLabel}
          href={opsHref(`/operations/${slug}/clients`)}
        />
        <KpiCard
          label="Outflow Paid"
          value={formatMoney(overview.outflowPaid, currency)}
          icon={PieChart}
          tone="success"
          trend={outflowTrend}
          href={opsHref(`/operations/${slug}/outflow/all?status=PAID`)}
        />
        <KpiCard
          label="Open Receivables"
          value={String(receivables.rows.length)}
          sublabel="Deals not fully collected"
          icon={HandCoins}
          href={opsHref(`/operations/${slug}/inflow/all?status=unpaid`)}
        />
      </div>

      {/* Each of these drills into its own page rather than a filtered list:
          the number behind them is a calculation, not a set of rows, so
          "show me the records" would not actually explain it. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Salary"
          value={formatMoney(salary.paid, currency)}
          sublabel={`${(salary.shareOfOutflow.toNumber() * 100).toFixed(0)}% of all spend`}
          icon={Wallet}
          href={insightHref("salary")}
        />
        <KpiCard
          label="Profit %"
          value={`${(profitMargin(profitability).toNumber() * 100).toFixed(1)}%`}
          sublabel={formatMoney(profitability.profit, currency)}
          icon={TrendingUp}
          tone={profitability.isLoss ? "default" : "success"}
          href={insightHref("profit")}
        />
        <KpiCard
          label="Loss %"
          value={`${(lossMargin(profitability).toNumber() * 100).toFixed(1)}%`}
          sublabel={profitability.isLoss ? "Expenses exceeded revenue" : "Trading at a profit"}
          icon={TrendingDown}
          tone={profitability.isLoss ? "destructive" : "default"}
          href={insightHref("loss")}
        />
        <KpiCard
          label="Client Payment Speed"
          value={`${paymentLag.averageDays} days`}
          sublabel={
            paymentLag.awaitingCount > 0
              ? `${paymentLag.awaitingCount} still unpaid`
              : `median ${paymentLag.medianDays} days`
          }
          icon={Timer}
          tone={paymentLag.averageDays > 30 ? "warning" : "default"}
          href={insightHref("paymentSpeed")}
        />
      </div>

      {/* Ageing sits high on the page and ignores the period filter — overdue
          money is the thing you most need to see, and hiding it because the
          user is looking at "This Month" would defeat the point. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AlertsPanel
          title="Receivables Ageing"
          description="Money owed to us by clients, by age"
          ageing={alerts.receivablesAgeing}
          overdueTotal={alerts.receivablesOverdue}
          items={alerts.topOverdueReceivables}
          currency={currency}
          emptyMessage="Every client balance is fully collected."
        />
        <AlertsPanel
          title="Payables Ageing"
          description="Expenses we still owe, by age"
          ageing={alerts.payablesAgeing}
          overdueTotal={alerts.payablesOverdue}
          items={alerts.topOverduePayables}
          currency={currency}
          emptyMessage="No outstanding expenses — everything is settled."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cash Flow Trend</CardTitle>
          <CardDescription>Inflow received vs outflow paid, last {cashFlowPoints.length} months</CardDescription>
        </CardHeader>
        <CardContent>
          {cashFlowPoints.length < 2 ? (
            <EmptyState
              title="Not enough history yet"
              description="A cash flow trend needs at least two months of recorded transactions."
            />
          ) : (
            <CashFlowChart data={cashFlowPoints} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Payment Status</CardTitle>
          </CardHeader>
          <CardContent>
            <WeeklyOutflowChart
              data={weeklySummary.weeks.map((w) => ({
                label: `WEEK ${w.week}`,
                paid: w.paid.toNumber(),
                pending: w.pending.toNumber(),
                formattedPaid: formatMoney(w.paid, currency),
                formattedPending: formatMoney(w.pending, currency),
                formattedTotal: formatMoney(w.totalDue, currency),
              }))}
            />
            {/* The workbook's Weekly Payment Status is a table of numbers, not
                just a picture. Keeping both so the exact figures stay readable. */}
            <table className="mt-4 w-full text-table">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-1.5 font-medium">Week</th>
                  <th className="py-1.5 text-right font-medium">Total Due</th>
                  <th className="py-1.5 text-right font-medium">Paid</th>
                  <th className="py-1.5 text-right font-medium">Pending</th>
                  <th className="py-1.5 text-right font-medium">% Paid</th>
                  <th className="py-1.5 text-right font-medium">% of Month</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {weeklySummary.weeks.map((w) => (
                  <tr key={w.week} className="hover:bg-accent/40">
                    <td className="py-1.5 text-muted-foreground">Week {w.week}</td>
                    <td className="py-1.5 text-right">{formatMoney(w.totalDue, currency)}</td>
                    <td className="py-1.5 text-right">{formatMoney(w.paid, currency)}</td>
                    <td className="py-1.5 text-right">{formatMoney(w.pending, currency)}</td>
                    <td className="py-1.5 text-right">{formatPercent(w.percentPaid)}</td>
                    <td className="py-1.5 text-right text-muted-foreground">{formatPercent(w.percentOfMonth)}</td>
                  </tr>
                ))}
                <tr className="border-t border-border font-medium">
                  <td className="py-1.5">Total</td>
                  <td className="py-1.5 text-right">{formatMoney(overview.totalOutflowDue, currency)}</td>
                  <td className="py-1.5 text-right">{formatMoney(overview.outflowPaid, currency)}</td>
                  <td className="py-1.5 text-right">{formatMoney(overview.outflowPending, currency)}</td>
                  <td className="py-1.5 text-right">{formatPercent(overview.percentOutflowSettled)}</td>
                  <td className="py-1.5 text-right text-muted-foreground">100%</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Payment Progress</CardTitle>
          </CardHeader>
          <CardContent>
            {overview.totalOutflowDue.eq(0) ? (
              <EmptyState title="No outflow this period" description="Payment progress will appear once expenses are recorded." />
            ) : (
              <>
                <DonutChart
                  segments={statusSegments}
                  centerValue={formatPercent(overview.percentOutflowSettled)}
                  centerLabel="settled"
                />
                {/* The workbook's Payment Progress block is Status / Items /
                    Pending amount. The donut covers status + item count, so the
                    pending amount per status belongs here too. */}
                <table className="mt-4 w-full text-table">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="py-1.5 font-medium">Status</th>
                      <th className="py-1.5 text-right font-medium">Items</th>
                      <th className="py-1.5 text-right font-medium">Amount Due</th>
                      <th className="py-1.5 text-right font-medium">Pending</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {weeklySummary.byStatus.map((s) => (
                      <tr key={s.status} className="hover:bg-accent/40">
                        <td className="py-1.5">
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="py-1.5 text-right">{s.items}</td>
                        <td className="py-1.5 text-right">{formatMoney(s.totalDue, currency)}</td>
                        <td className="py-1.5 text-right font-medium">{formatMoney(s.pending, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mirrors the workbook Dashboard's INFLOW SUMMARY block, which the
          earlier UI pass never surfaced even though getInflowSummary already
          computed every one of these figures. */}
      <Card>
        <CardHeader>
          <CardTitle>Inflow Summary</CardTitle>
          <CardDescription>Client deals closed and collection performance {rangeLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          {inflowSummary.clientsClosed === 0 ? (
            <EmptyState
              title="No client deals recorded"
              description={`No inflow has been recorded for ${businessEntity.name} ${rangeLabel}.`}
              actionLabel="Add inflow"
              actionHref={`/operations/${slug}/inflow/new`}
            />
          ) : (
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              <SummaryStat label="Total deal value closed" value={formatMoney(inflowSummary.totalDealValue, currency)} />
              <SummaryStat label="Total amount received" value={formatMoney(inflowSummary.totalReceived, currency)} tone="success" />
              <SummaryStat label="Balance receivable" value={formatMoney(inflowSummary.balanceReceivable, currency)} tone="warning" />
              <SummaryStat label="Collection rate" value={formatPercent(inflowSummary.collectionRate)} />
              <SummaryStat label="New clients closed" value={String(inflowSummary.newClientsClosed)} />
              <SummaryStat
                label="Renewals / upsells / existing"
                value={String(inflowSummary.existingOrRepeatClientsClosed)}
              />
              <SummaryStat label="Average deal size" value={formatMoney(inflowSummary.averageDealSize, currency)} />
              <SummaryStat label="Total clients closed" value={String(inflowSummary.clientsClosed)} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Expense by Category</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {categoriesWithActivity.length === 0 ? (
            <EmptyState
              title="No expenses recorded"
              description={`No expenses have been recorded for ${businessEntity.name} ${rangeLabel}.`}
              actionLabel="Add expense"
              actionHref={`/operations/${slug}/outflow/new`}
            />
          ) : (
            <table className="w-full min-w-[620px] text-table">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Category</th>
                  <th className="w-[26%] py-2 font-medium">Share of spend</th>
                  <th className="py-2 text-right font-medium">Total Due</th>
                  <th className="py-2 text-right font-medium">Paid</th>
                  <th className="py-2 text-right font-medium">Pending</th>
                  <th className="py-2 text-right font-medium">% Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {categoriesWithActivity.map((c) => {
                  const share = largestCategoryDue > 0 ? c.totalDue.toNumber() / largestCategoryDue : 0;
                  const paidShare = c.totalDue.gt(0) ? c.paid.toNumber() / c.totalDue.toNumber() : 0;
                  return (
                    <tr key={c.categoryId} className="hover:bg-accent/40">
                      <td className="py-2 pr-3">{c.categoryName}</td>
                      <td className="py-2 pr-4">
                        {/* Bar length = size of the category, filled portion = how much of it is settled. */}
                        <div
                          className="h-1.5 overflow-hidden rounded-full bg-muted"
                          style={{ width: `${Math.max(share * 100, 4)}%` }}
                        >
                          <div className="h-full rounded-full bg-success" style={{ width: `${paidShare * 100}%` }} />
                        </div>
                      </td>
                      <td className="py-2 text-right">{formatMoney(c.totalDue, currency)}</td>
                      <td className="py-2 text-right">{formatMoney(c.paid, currency)}</td>
                      <td className="py-2 text-right">{formatMoney(c.pending, currency)}</td>
                      <td className="py-2 text-right font-medium">{formatPercent(c.percentPaid)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Receivables</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {receivables.rows.length === 0 ? (
            <EmptyState title="No open receivables" description="Every client balance for this period has been fully collected." />
          ) : (
            <table className="w-full min-w-[560px] text-table">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Client</th>
                  <th className="py-2 font-medium">Service / Project</th>
                  <th className="py-2 text-right font-medium">Deal Value</th>
                  <th className="py-2 text-right font-medium">Received</th>
                  <th className="py-2 text-right font-medium">Balance Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {receivables.rows.slice(0, 10).map((r) => (
                  <tr key={r.transactionId} className="hover:bg-accent/40">
                    <td className="py-2">
                      <Link href={`/operations/transactions/${r.transactionId}`} className="transition-ui hover:underline">
                        {r.clientName}
                      </Link>
                    </td>
                    <td className="py-2 text-muted-foreground">{r.description}</td>
                    <td className="py-2 text-right">{formatMoney(r.dealValue, currency)}</td>
                    <td className="py-2 text-right">{formatMoney(r.received, currency)}</td>
                    <td className="py-2 text-right font-medium">{formatMoney(r.balanceDue, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-4 text-label font-medium">
        <Link href={`/operations/${slug}/inflow/all`} className="text-brand transition-ui hover:underline">
          View all Inflow →
        </Link>
        <Link href={`/operations/${slug}/outflow/all`} className="text-brand transition-ui hover:underline">
          View all Outflow →
        </Link>
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <div>
      <p className="text-metadata">{label}</p>
      <p
        className={
          tone === "success"
            ? "mt-0.5 text-metric-sm text-success"
            : tone === "warning"
              ? "mt-0.5 text-metric-sm text-warning"
              : "mt-0.5 text-metric-sm"
        }
      >
        {value}
      </p>
    </div>
  );
}

function PageHeader({ title, subtitle, controls }: { title: string; subtitle: string; controls: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-page-title">{title}</h1>
        <p className="mt-0.5 text-page-subtitle">{subtitle}</p>
      </div>
      {controls}
    </div>
  );
}
