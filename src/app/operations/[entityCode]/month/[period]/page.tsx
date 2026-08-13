import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  CheckCircle2,
  Clock,
  Scale,
  Users,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireEntityBySlug } from "@/lib/entities";
import { requireUser, canWriteEntity } from "@/lib/rbac";
import { formatMoney } from "@/lib/format";
import { parsePeriodKey, periodRange, periodLabel, formatPeriodKey } from "@/domain/finance/period";
import {
  getInflowSummary,
  getOutflowSummary,
  getCategorySummary,
  getWeeklySummary,
} from "@/services/finance/summary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/finance/kpi-card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ExportMenu } from "@/components/finance/export-menu";
import { Button } from "@/components/ui/button";

/**
 * One month's books, laid out as the workbook's Dashboard sheet.
 *
 * The workbook is a file per month whose first sheet is a summary and whose
 * later sheets are the trackers and their roll-ups. This is that first
 * sheet: the same KPI block, the same Category Summary with its WEEK 1-4
 * columns, and the same Weekly Summary — computed from the rows rather than
 * maintained by hand, so unlike the spreadsheet they cannot fall out of step
 * with the trackers they describe.
 */
export default async function MonthDashboardPage({
  params,
}: {
  params: Promise<{ entityCode: string; period: string }>;
}) {
  const { entityCode, period: periodKey } = await params;
  const period = parsePeriodKey(periodKey);
  if (!period) notFound();

  const entity = await requireEntityBySlug(entityCode);
  const user = await requireUser();
  const canWrite = canWriteEntity(user.role, entity.code);
  const currency = entity.baseCurrency;
  const range = periodRange(period);

  const [inflow, outflow, categories, weekly, txnCount] = await Promise.all([
    getInflowSummary(entity.id, range),
    getOutflowSummary(entity.id, range),
    getCategorySummary(entity.id, range),
    getWeeklySummary(entity.id, range),
    prisma.financialTransaction.count({
      where: { entityId: entity.id, transactionDate: { gte: range.from, lte: range.to } },
    }),
  ]);

  const netPosition = inflow.totalReceived.minus(outflow.totalPaid);
  const base = `/operations/${entityCode}`;
  const key = formatPeriodKey(period);

  if (txnCount === 0) {
    return (
      <div>
        <BackLink href={base} />
        <h2 className="mt-1 text-page-title">
          {entity.name} · {periodLabel(period)}
        </h2>
        <div className="mt-6">
          <EmptyState
            title="Nothing recorded for this month"
            description={
              canWrite
                ? "Add entries in the Inflow or Outflow sheet and this dashboard fills itself in."
                : "No entries have been made for this month."
            }
            actionLabel={canWrite ? "Open Inflow sheet" : undefined}
            actionHref={canWrite ? `${base}/inflow/${key}` : undefined}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <BackLink href={base} />
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-page-title">
              {entity.name} · {periodLabel(period)}
            </h2>
            <p className="mt-0.5 text-page-subtitle">
              Month dashboard · {txnCount} {txnCount === 1 ? "entry" : "entries"} · {currency}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Same month, same figures — the download is this page's data,
                in the workbook's own layout. */}
            <ExportMenu entityId={entity.id} month={key} label={`Download ${periodLabel(period)}`} />
            <Link href={`${base}/inflow/${key}`}>
              <Button size="sm" variant="outline">
                Inflow sheet
              </Button>
            </Link>
            <Link href={`${base}/outflow/${key}`}>
              <Button size="sm" variant="outline">
                Outflow sheet
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* The workbook's INFLOW SUMMARY block. */}
      <div>
        <h3 className="text-section-title">Inflow Summary</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Deal Value"
            value={formatMoney(inflow.totalDealValue, currency)}
            sublabel={inflow.taxInvoiced.gt(0) ? `net of ${formatMoney(inflow.taxInvoiced, currency)} tax` : undefined}
            icon={ArrowDownToLine}
          />
          <KpiCard
            label="Received"
            value={formatMoney(inflow.totalReceived, currency)}
            icon={CheckCircle2}
            tone="success"
            progress={
              inflow.grossDealValue.gt(0) ? inflow.grossReceived.toNumber() / inflow.grossDealValue.toNumber() : 0
            }
          />
          <KpiCard
            label="Balance Receivable"
            value={formatMoney(inflow.balanceReceivable, currency)}
            icon={Clock}
            tone="warning"
            href={`${base}/inflow/all?status=unpaid`}
          />
          <KpiCard
            label="Clients Closed"
            value={String(inflow.clientsClosed)}
            sublabel={`${inflow.newClientsClosed} new · ${inflow.existingOrRepeatClientsClosed} existing`}
            icon={Users}
            href={`${base}/clients`}
          />
        </div>
      </div>

      {/* The workbook's TOTAL OUTFLOW / PAID / PENDING block, with the
          Net Position figure the Dashboard sheet closes on. */}
      <div>
        <h3 className="text-section-title">Outflow Summary</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total Due" value={formatMoney(outflow.totalDue, currency)} icon={ArrowUpFromLine} />
          <KpiCard
            label="Paid"
            value={formatMoney(outflow.totalPaid, currency)}
            icon={CheckCircle2}
            tone="success"
            progress={outflow.totalDue.gt(0) ? outflow.totalPaid.toNumber() / outflow.totalDue.toNumber() : 0}
            href={`${base}/outflow/all?status=PAID`}
          />
          <KpiCard
            label="Pending"
            value={formatMoney(outflow.totalPending, currency)}
            icon={Clock}
            tone="warning"
            href={`${base}/outflow/all?status=unpaid`}
          />
          <KpiCard
            label="% Settled"
            value={`${(outflow.percentSettled.toNumber() * 100).toFixed(1)}%`}
            icon={Scale}
            tone="brand"
          />
        </div>
      </div>

      <div>
        <h3 className="text-section-title">Net Position</h3>
        <div className="mt-3">
          <KpiCard
            label="Inflow received minus outflow paid"
            value={formatMoney(netPosition, currency)}
            sublabel="Not profit — profit also counts what is still owed"
            icon={Scale}
            tone={netPosition.gte(0) ? "success" : "destructive"}
          />
        </div>
      </div>

      {/* Category Summary — the workbook sheet of the same name, including
          its WEEK 1-4 columns. */}
      <Card>
        <CardHeader>
          <CardTitle>Category Summary</CardTitle>
          <CardDescription>Spend by category, split across the month&rsquo;s four weeks.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {categories.length === 0 ? (
            <EmptyState title="No expenses this month" description="Nothing has been recorded on the Outflow sheet." />
          ) : (
            <table className="w-full min-w-[760px] text-table">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Category</th>
                  <th className="py-2 text-right font-medium">Week 1</th>
                  <th className="py-2 text-right font-medium">Week 2</th>
                  <th className="py-2 text-right font-medium">Week 3</th>
                  <th className="py-2 text-right font-medium">Week 4</th>
                  <th className="py-2 text-right font-medium">Total Due</th>
                  <th className="py-2 text-right font-medium">Paid</th>
                  <th className="py-2 text-right font-medium">Pending</th>
                  <th className="py-2 text-right font-medium">% Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {categories.map((r) => (
                  <tr key={r.categoryId} className="hover:bg-accent/40">
                    <td className="py-2.5">{r.categoryName}</td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">{formatMoney(r.week1, currency)}</td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">{formatMoney(r.week2, currency)}</td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">{formatMoney(r.week3, currency)}</td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">{formatMoney(r.week4, currency)}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatMoney(r.totalDue, currency)}</td>
                    <td className="py-2.5 text-right tabular-nums text-success">{formatMoney(r.paid, currency)}</td>
                    <td className="py-2.5 text-right font-medium tabular-nums">{formatMoney(r.pending, currency)}</td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                      {(r.percentPaid.toNumber() * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-border font-semibold">
                  <td className="py-2.5">Total</td>
                  <td colSpan={4} />
                  <td className="py-2.5 text-right tabular-nums">{formatMoney(outflow.totalDue, currency)}</td>
                  <td className="py-2.5 text-right tabular-nums text-success">{formatMoney(outflow.totalPaid, currency)}</td>
                  <td className="py-2.5 text-right tabular-nums">{formatMoney(outflow.totalPending, currency)}</td>
                  <td className="py-2.5 text-right tabular-nums">
                    {(outflow.percentSettled.toNumber() * 100).toFixed(0)}%
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Weekly Summary — the workbook sheet of the same name. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Summary</CardTitle>
            <CardDescription>Outflow by week of the month.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-table">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Week</th>
                  <th className="py-2 text-right font-medium">Items</th>
                  <th className="py-2 text-right font-medium">Due</th>
                  <th className="py-2 text-right font-medium">Paid</th>
                  <th className="py-2 text-right font-medium">Pending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {weekly.weeks.map((w) => (
                  <tr key={w.week} className="hover:bg-accent/40">
                    <td className="py-2.5">Week {w.week}</td>
                    <td className="py-2.5 text-right text-muted-foreground tabular-nums">{w.items}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatMoney(w.totalDue, currency)}</td>
                    <td className="py-2.5 text-right tabular-nums text-success">{formatMoney(w.paid, currency)}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatMoney(w.pending, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By status</CardTitle>
            <CardDescription>How much of the month&rsquo;s spend is settled.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-table">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 text-right font-medium">Items</th>
                  <th className="py-2 text-right font-medium">Due</th>
                  <th className="py-2 text-right font-medium">Pending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {weekly.byStatus.map((s) => (
                  <tr key={s.status} className="hover:bg-accent/40">
                    <td className="py-2.5">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="py-2.5 text-right text-muted-foreground tabular-nums">{s.items}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatMoney(s.totalDue, currency)}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatMoney(s.pending, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <p className="text-metadata">
        Every figure here is computed from the month&rsquo;s entries, so it cannot drift from the trackers the way the
        spreadsheet&rsquo;s hand-maintained summary cells could.
      </p>
    </div>
  );
}

function BackLink({ href }: { href: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-metadata transition-ui hover:text-foreground">
      <ArrowLeft className="h-3 w-3" />
      All months
    </Link>
  );
}
