import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Currency } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, canViewIntelligenceEntity, canAccessOperations } from "@/lib/rbac";
import { formatMoney, formatDate } from "@/lib/format";
import { entitySlug } from "@/lib/entities";
import { parseRangeSelection, resolveSelection, describeSelectionLong } from "@/domain/finance/date-range";
import { parseInsight } from "@/domain/finance/insight-metrics";
import { lossMargin, profitMargin, SALARY_CATEGORY_NAMES } from "@/domain/finance/profitability";
import { getSalarySummary, getProfitability, getPaymentLag } from "@/services/finance/profitability";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * The page behind a Finance View card.
 *
 * One route for every insight rather than four near-identical pages: they
 * share the same header, period handling and access rules, and only the
 * body differs.
 */
export default async function InsightPage({
  searchParams,
}: {
  searchParams: Promise<{ insight?: string; entity?: string; range?: string; month?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();

  const insight = parseInsight(params.insight);
  if (!insight) notFound();

  // These figures are entity-specific; there is no meaningful combined
  // "profit %" without converting currencies, which the breakdown page
  // handles separately.
  const entityCode = params.entity === "UAE" || params.entity === "INDIA" ? params.entity : null;
  if (!entityCode) notFound();
  if (!canViewIntelligenceEntity(user.role, entityCode)) notFound();

  const entity = await prisma.businessEntity.findUnique({ where: { code: entityCode } });
  if (!entity) notFound();

  const selection = parseRangeSelection(params);
  const range = resolveSelection(selection);
  const rangeLabel = describeSelectionLong(selection);
  const currency: Currency = entity.baseCurrency;
  const slug = entitySlug(entity.code);
  const showOpsLinks = canAccessOperations(user.role);

  const backQs = new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string] => e[0] !== "insight" && typeof e[1] === "string")
  );
  const backHref = `/intelligence${backQs.toString() ? `?${backQs}` : ""}`;

  return (
    <div className="space-y-6">
      <div>
        <Link href={backHref} className="inline-flex items-center gap-1 text-metadata transition-ui hover:text-foreground">
          <ArrowLeft className="h-3 w-3" />
          Back to Finance View
        </Link>
        <h1 className="mt-1 text-page-title">
          {insight.label} · {entity.name}
        </h1>
        <p className="mt-0.5 text-page-subtitle">
          {insight.description} {rangeLabel}.
        </p>
      </div>

      {insight.key === "salary" && (
        <SalaryDetail entityId={entity.id} range={range} currency={currency} slug={slug} showOpsLinks={showOpsLinks} title={insight.detailTitle} />
      )}
      {(insight.key === "profit" || insight.key === "loss") && (
        <ProfitDetail entityId={entity.id} range={range} currency={currency} mode={insight.key} />
      )}
      {insight.key === "paymentSpeed" && (
        <PaymentSpeedDetail entityId={entity.id} range={range} currency={currency} title={insight.detailTitle} />
      )}
    </div>
  );
}

async function SalaryDetail({
  entityId,
  range,
  currency,
  slug,
  showOpsLinks,
  title,
}: {
  entityId: string;
  range: { from: Date; to: Date };
  currency: Currency;
  slug: string;
  showOpsLinks: boolean;
  title: string;
}) {
  const salary = await getSalarySummary(entityId, range);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Payroll due" value={formatMoney(salary.due, currency)} />
        <Stat label="Paid" value={formatMoney(salary.paid, currency)} tone="success" />
        <Stat label="Still owed" value={formatMoney(salary.pending, currency)} tone="warning" />
        <Stat label="Share of all spend" value={`${(salary.shareOfOutflow.toNumber() * 100).toFixed(1)}%`} tone="brand" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            Payroll rows with no department are shown as Unassigned rather than dropped — a salary total that omitted
            them would be wrong, not merely partial.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {salary.byDepartment.length === 0 ? (
            <EmptyState
              title="No payroll recorded"
              description="Nothing in Salaries & Allowances falls in this period."
            />
          ) : (
            <table className="w-full min-w-[560px] text-table">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Department</th>
                  <th className="py-2 text-right font-medium">Entries</th>
                  <th className="py-2 text-right font-medium">Due</th>
                  <th className="py-2 text-right font-medium">Paid</th>
                  <th className="py-2 text-right font-medium">Still owed</th>
                  {showOpsLinks && <th className="py-2 text-right font-medium" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {salary.byDepartment.map((d) => (
                  <tr key={d.departmentId ?? "unassigned"} className="hover:bg-accent/40">
                    <td className="py-2.5">
                      {d.departmentName}
                      {!d.departmentId && (
                        <Badge variant="neutral" className="ml-2">
                          Untagged
                        </Badge>
                      )}
                    </td>
                    <td className="py-2.5 text-right text-muted-foreground tabular-nums">{d.headcountRows}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatMoney(d.due, currency)}</td>
                    <td className="py-2.5 text-right tabular-nums text-success">{formatMoney(d.paid, currency)}</td>
                    <td className="py-2.5 text-right font-medium tabular-nums">{formatMoney(d.pending, currency)}</td>
                    {showOpsLinks && (
                      <td className="py-2.5 text-right">
                        {/* Carries the payroll category AND this row's
                            department, so the list that opens is the rows
                            that made up this line — not every paid expense. */}
                        <Link
                          href={
                            `/operations/${slug}/outflow/all` +
                            `?category=${encodeURIComponent(SALARY_CATEGORY_NAMES.join(","))}` +
                            `&department=${d.departmentId ?? "none"}`
                          }
                          className="inline-flex items-center gap-1 text-label font-medium text-brand transition-ui hover:underline"
                        >
                          Records
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

async function ProfitDetail({
  entityId,
  range,
  currency,
  mode,
}: {
  entityId: string;
  range: { from: Date; to: Date };
  currency: Currency;
  mode: "profit" | "loss";
}) {
  const p = await getProfitability(entityId, range);
  const margin = mode === "loss" ? lossMargin(p) : profitMargin(p);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Revenue received" value={formatMoney(p.revenue, currency)} tone="success" />
        <Stat label="Expenses paid" value={formatMoney(p.expenses, currency)} tone="warning" />
        {/* Labelled by what the number IS, not by which page you opened.
            Driving the label off `mode` printed "Loss" over a profit while
            the breakdown below said "Profit" — two figures contradicting
            each other on one screen. */}
        <Stat
          label={p.isLoss ? "Loss" : "Profit"}
          value={formatMoney(p.profit.abs(), currency)}
          tone={p.isLoss ? "destructive" : "success"}
        />
        <Stat label={mode === "loss" ? "Loss %" : "Profit %"} value={`${(margin.toNumber() * 100).toFixed(1)}%`} tone="brand" />
      </div>

      <Card>
        <CardHeader>
          {/* Same rule as the tile: describe what happened, not which page
              was opened. "What drove the loss" over a profit is nonsense. */}
          <CardTitle>{p.isLoss ? "What drove the loss" : "What made up the profit"}</CardTitle>
          <CardDescription>
            Cash basis — money actually received against money actually paid, so this ties to the Net Position tile.
            Revenue excludes tax, which is collected for the government rather than earned.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-table">
            <tbody className="divide-y divide-border-subtle">
              <Line label="Revenue received (net of tax)" value={formatMoney(p.revenue, currency)} />
              <Line label="Payroll paid" value={`− ${formatMoney(p.salaryPaid, currency)}`} />
              <Line label="Other expenses paid" value={`− ${formatMoney(p.otherExpensesPaid, currency)}`} />
              <tr className="border-t border-border font-semibold">
                <td className="py-2.5">{p.isLoss ? "Loss" : "Profit"}</td>
                <td className={`py-2.5 text-right tabular-nums ${p.isLoss ? "text-destructive" : "text-success"}`}>
                  {formatMoney(p.profit, currency)}
                </td>
              </tr>
            </tbody>
          </table>
          {mode === "loss" && !p.isLoss && (
            <p className="mt-3 rounded-lg border border-success/30 bg-success-subtle px-3 py-2 text-sm text-success">
              No loss this period — revenue covered every expense paid, leaving a profit of{" "}
              {formatMoney(p.profit, currency)}.
            </p>
          )}
          {mode === "profit" && p.isLoss && (
            <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive-subtle px-3 py-2 text-sm text-destructive">
              No profit this period — expenses paid exceeded revenue received by {formatMoney(p.profit.abs(), currency)}.
            </p>
          )}
          {p.revenue.eq(0) && (
            <p className="mt-3 text-metadata">
              No revenue was received in this period, so the percentage is shown as 0% rather than as a division by
              zero.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

async function PaymentSpeedDetail({
  entityId,
  range,
  currency,
  title,
}: {
  entityId: string;
  range: { from: Date; to: Date };
  currency: Currency;
  title: string;
}) {
  const lag = await getPaymentLag(entityId, range);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Average days to pay" value={`${lag.averageDays}`} tone="brand" />
        <Stat label="Median" value={`${lag.medianDays}`} />
        <Stat label="Slowest" value={`${lag.slowest} days`} tone="warning" />
        <Stat label="Still unpaid" value={`${lag.awaitingCount}`} tone={lag.awaitingCount > 0 ? "destructive" : "default"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            Days from the deal being booked to the first payment arriving. Deals with nothing received yet are listed
            but excluded from the averages — counting them as zero days would make unpaid work look like instant
            payment.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {lag.rows.length === 0 ? (
            <EmptyState title="No deals in this period" description="Nothing was booked in the selected range." />
          ) : (
            <table className="w-full min-w-[640px] text-table">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Client</th>
                  <th className="py-2 font-medium">Service / Project</th>
                  <th className="py-2 font-medium">Booked</th>
                  <th className="py-2 font-medium">First paid</th>
                  <th className="py-2 text-right font-medium">Days</th>
                  <th className="py-2 text-right font-medium">Deal value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {lag.rows.map((r) => (
                  <tr key={r.transactionId} className="hover:bg-accent/40">
                    <td className="py-2.5">{r.clientName}</td>
                    <td className="py-2.5 text-muted-foreground">{r.description}</td>
                    <td className="py-2.5">{formatDate(r.startedOn)}</td>
                    <td className="py-2.5">{r.firstPaidOn ? formatDate(r.firstPaidOn) : "—"}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      {r.days === null ? (
                        <Badge variant="warning" dot>
                          Unpaid
                        </Badge>
                      ) : (
                        r.days
                      )}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{formatMoney(r.dealValue, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "destructive" | "brand";
}) {
  const toneClass = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
    brand: "text-brand",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-card-title">{label}</p>
      <p className={`mt-1 text-metric-sm tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="py-2.5">{label}</td>
      <td className="py-2.5 text-right tabular-nums">{value}</td>
    </tr>
  );
}
