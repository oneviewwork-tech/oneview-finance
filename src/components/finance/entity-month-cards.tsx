import Link from "next/link";
import type { Currency } from "@prisma/client";
import { FileSpreadsheet, FileText, ChevronRight } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { periodLabel, currentPeriod, type Period } from "@/domain/finance/period";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export interface EntityMonthRow extends Period {
  key: string;
  inflowReceived: number;
  outflowPaid: number;
  net: number;
  inflowCount: number;
  outflowCount: number;
}

/**
 * The entity's books month by month, as cards.
 *
 * Same shape as the month cards on the Inflow and Outflow tabs, so a month
 * looks like a month wherever you meet it — the earlier table read as a
 * report rather than as the set of things you open. Each card opens that
 * month's Dashboard and downloads as the workbook, scoped to the month.
 */
export function EntityMonthCards({
  months,
  currency,
  entityId,
  entityCode,
}: {
  months: EntityMonthRow[];
  currency: Currency;
  entityId: string;
  entityCode: string;
}) {
  const now = currentPeriod();
  const exportHref = (key: string, format: "xlsx" | "pdf") =>
    `/api/export/transactions?entityId=${entityId}&format=${format}&range=MONTH&month=${key}`;

  if (months.length === 0) {
    return (
      <EmptyState
        title="Nothing recorded yet"
        description="Create a month under Inflow or Outflow and it will appear here."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {months.map((m) => {
        const isCurrent = m.year === now.year && m.month === now.month;
        const positive = m.net >= 0;
        return (
          <div
            key={m.key}
            className="group rounded-xl border border-border bg-card p-4 transition-ui hover:border-brand/40 hover:shadow-md"
          >
            <Link
              href={`/operations/${entityCode}/month/${m.key}`}
              className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{periodLabel({ year: m.year, month: m.month })}</p>
                  <p className="mt-0.5 text-metadata">
                    {m.inflowCount + m.outflowCount} {m.inflowCount + m.outflowCount === 1 ? "entry" : "entries"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {isCurrent && <Badge variant="brand">Current</Badge>}
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>

              <div className="mt-3 space-y-1.5 text-xs">
                <Row label="Inflow received" value={formatMoney(m.inflowReceived, currency)} className="text-success" />
                <Row label="Outflow paid" value={formatMoney(m.outflowPaid, currency)} />
                {/* The figure worth colouring: a month that spent more than
                    it took in is what you're scanning for. */}
                <Row
                  label="Net"
                  value={formatMoney(m.net, currency)}
                  className={positive ? "text-success font-medium" : "text-destructive font-medium"}
                />
              </div>
            </Link>

            <div className="mt-3 flex items-center gap-1.5 border-t border-border-subtle pt-3">
              {/* Plain anchors, not fetches: the browser has to own the
                  request for the file to land in Downloads. */}
              <a
                href={exportHref(m.key, "xlsx")}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs transition-ui hover:bg-accent"
                title={`Download ${periodLabel({ year: m.year, month: m.month })} as Excel`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Excel
              </a>
              <a
                href={exportHref(m.key, "pdf")}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs transition-ui hover:bg-accent"
                title={`Download ${periodLabel({ year: m.year, month: m.month })} as PDF`}
              >
                <FileText className="h-3.5 w-3.5" />
                PDF
              </a>
            </div>
          </div>
        );
      })}
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
