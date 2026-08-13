import Link from "next/link";
import type { Currency } from "@prisma/client";
import { FileSpreadsheet, FileText, ChevronRight } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { periodLabel, type Period } from "@/domain/finance/period";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
 * The entity's books month by month, the way the workbook is filed.
 *
 * The overview previously showed all-time totals only, which answers a
 * question nobody asks — the accounts team works a month at a time, and
 * each row here downloads as the same Payment Tracker / Inflow Tracker
 * workbook they already use, scoped to that month.
 */
export function EntityMonthTable({
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
  const exportHref = (key: string, format: "xlsx" | "pdf") =>
    `/api/export/transactions?entityId=${entityId}&format=${format}&range=MONTH&month=${key}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Month by month</CardTitle>
        <CardDescription>
          Received against paid for each month, with the same trackers you work in — download one month as Excel or
          PDF.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {months.length === 0 ? (
          <EmptyState
            title="Nothing recorded yet"
            description="Create a month under Inflow or Outflow and it will appear here."
          />
        ) : (
          <table className="w-full min-w-[720px] text-table">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2 font-medium">Month</th>
                <th className="py-2 text-right font-medium">Inflow received</th>
                <th className="py-2 text-right font-medium">Outflow paid</th>
                <th className="py-2 text-right font-medium">Net</th>
                <th className="py-2 text-right font-medium">Entries</th>
                <th className="py-2 text-right font-medium">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {months.map((m) => (
                <tr key={m.key} className="hover:bg-accent/40">
                  <td className="py-2.5">
                    <Link
                      href={`/operations/${entityCode}/inflow/${m.key}`}
                      className="group inline-flex items-center gap-1 font-medium text-brand transition-ui hover:underline"
                    >
                      {periodLabel({ year: m.year, month: m.month })}
                      <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-success">
                    {formatMoney(m.inflowReceived, currency)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{formatMoney(m.outflowPaid, currency)}</td>
                  {/* The one figure worth colouring: a month that spent more
                      than it took in is the thing you're scanning for. */}
                  <td
                    className={`py-2.5 text-right font-medium tabular-nums ${
                      m.net >= 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    {formatMoney(m.net, currency)}
                  </td>
                  <td className="py-2.5 text-right text-metadata tabular-nums">
                    {m.inflowCount + m.outflowCount}
                  </td>
                  <td className="py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Plain links, not fetches: the browser has to own the
                          download for the file to land in Downloads. */}
                      <a
                        href={exportHref(m.key, "xlsx")}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs transition-ui hover:bg-accent"
                        title={`Download ${periodLabel({ year: m.year, month: m.month })} as Excel`}
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        Excel
                      </a>
                      <a
                        href={exportHref(m.key, "pdf")}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs transition-ui hover:bg-accent"
                        title={`Download ${periodLabel({ year: m.year, month: m.month })} as PDF`}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        PDF
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
