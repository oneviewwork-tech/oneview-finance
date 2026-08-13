import Link from "next/link";
import type { Currency } from "@prisma/client";
import { ArrowLeft, Plus } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { type Period, periodLabel } from "@/domain/finance/period";

export interface SheetColumn {
  key: string;
  label: string;
  align?: "left" | "right";
  /** Rendered in the workbook's "you type this" tint rather than derived. */
  entry?: boolean;
}

export interface SheetRow {
  id: string;
  cells: Record<string, string>;
  status: "PENDING" | "PARTIAL" | "PAID";
}

/**
 * One month of the books, laid out like the sheet it replaces.
 *
 * The workbook prints a LIVE TOTALS band above the rows — Total Due, Paid,
 * Pending, % Settled — and that band is the first thing anyone looks at.
 * Reproducing it here is the point of the whole month view: the numbers are
 * computed from the rows rather than maintained by hand, so unlike the
 * spreadsheet they cannot drift out of agreement with what's below them.
 */
export function MonthSheet({
  period,
  entityName,
  currency,
  columns,
  rows,
  totals,
  backHref,
  addHref,
  canWrite,
  labels,
}: {
  period: Period;
  entityName: string;
  currency: Currency;
  columns: SheetColumn[];
  rows: SheetRow[];
  totals: { total: number; settled: number; outstanding: number; settledFraction: number };
  backHref: string;
  addHref: string;
  canWrite: boolean;
  labels: { title: string; total: string; settled: string; outstanding: string };
}) {
  return (
    <div>
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-metadata transition-ui hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        All months
      </Link>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-page-title">
            {entityName} · {periodLabel(period)}
          </h2>
          <p className="mt-0.5 text-page-subtitle">
            {labels.title} · {rows.length} {rows.length === 1 ? "entry" : "entries"} · {currency}
          </p>
        </div>
        {canWrite && (
          <Link href={addHref}>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add entry
            </Button>
          </Link>
        )}
      </div>

      {/* The workbook's LIVE TOTALS row. Same three figures, same order, so
          someone moving off the spreadsheet reads it without relearning. */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TotalTile label={labels.total} value={formatMoney(totals.total, currency)} />
        <TotalTile label={labels.settled} value={formatMoney(totals.settled, currency)} tone="success" />
        <TotalTile label={labels.outstanding} value={formatMoney(totals.outstanding, currency)} tone="destructive" />
        <TotalTile label="% Settled" value={`${(totals.settledFraction * 100).toFixed(1)}%`} tone="brand" />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="This month is empty"
              description={
                canWrite
                  ? "Add the first entry and the totals above will fill themselves in."
                  : "Nothing has been entered for this month."
              }
              actionLabel={canWrite ? "Add entry" : undefined}
              actionHref={canWrite ? addHref : undefined}
            />
          </div>
        ) : (
          <table className="w-full text-table">
            <thead className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">#</th>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={`px-3 py-2.5 font-medium ${c.align === "right" ? "text-right" : ""}`}
                  >
                    {c.label}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map((row, i) => (
                <tr key={row.id} className="transition-ui hover:bg-accent/40">
                  <td className="px-3 py-2.5 text-metadata tabular-nums">{i + 1}</td>
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-3 py-2.5 ${c.align === "right" ? "text-right tabular-nums" : ""}`}
                    >
                      {row.cells[c.key] ?? "-"}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {rows.length > 0 && (
        <p className="mt-2 text-metadata">
          Totals above are computed from these rows — unlike the spreadsheet, they cannot fall out of step with them.
        </p>
      )}
    </div>
  );
}

function TotalTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "destructive" | "brand";
}) {
  const toneClass = {
    default: "text-foreground",
    success: "text-success",
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

export { formatDate };
