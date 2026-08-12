import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import type { Currency } from "@prisma/client";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AgeingSummaryRow, AlertSeverity } from "@/domain/finance/alerts";
import type { OverdueItem } from "@/services/finance/alerts";

const SEVERITY_VARIANT: Record<AlertSeverity, "brand" | "warning" | "destructive"> = {
  info: "brand",
  warning: "warning",
  critical: "destructive",
};

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  info: "Due",
  warning: "Overdue",
  critical: "Critical",
};

/** Ageing table + the specific items worth chasing, for one side of the ledger. */
export function AlertsPanel({
  title,
  description,
  ageing,
  overdueTotal,
  items,
  currency,
  emptyMessage,
}: {
  title: string;
  description: string;
  ageing: AgeingSummaryRow[];
  overdueTotal: import("@prisma/client").Prisma.Decimal;
  items: OverdueItem[];
  currency: Currency;
  emptyMessage: string;
}) {
  const nothingOutstanding = ageing.every((r) => r.count === 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {!nothingOutstanding && overdueTotal.gt(0) && (
            <div className="text-right">
              <p className="text-metadata">Overdue</p>
              <p className="text-metric-sm text-destructive">{formatMoney(overdueTotal, currency)}</p>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {nothingOutstanding ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-success/25 bg-success-subtle px-3.5 py-3 text-sm text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {emptyMessage}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-table">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2 font-medium">Age</th>
                    <th className="py-2 text-right font-medium">Items</th>
                    <th className="py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {ageing.map((row) => (
                    <tr
                      key={row.bucket}
                      className={cn("hover:bg-accent/40", row.count === 0 && "text-muted-foreground")}
                    >
                      <td className="py-2">
                        {row.bucket === "CURRENT" ? (
                          row.label
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {row.label}
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right tabular-nums">{row.count}</td>
                      <td
                        className={cn(
                          "py-2 text-right tabular-nums",
                          row.bucket !== "CURRENT" && row.total.gt(0) && "font-medium"
                        )}
                      >
                        {formatMoney(row.total, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {items.length > 0 && (
              <div className="mt-5">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Needs attention
                </p>
                <ul className="mt-2 divide-y divide-border-subtle">
                  {items.map((item) => (
                    <li key={item.transactionId} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <Link
                          href={`/operations/transactions/${item.transactionId}`}
                          className="truncate text-sm font-medium transition-ui hover:underline"
                        >
                          {item.counterparty}
                        </Link>
                        <p className="truncate text-metadata">
                          {item.description} · {item.daysOverdue} days
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums">
                          {formatMoney(item.outstanding, currency)}
                        </span>
                        <Badge variant={SEVERITY_VARIANT[item.severity]} dot>
                          {SEVERITY_LABEL[item.severity]}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
