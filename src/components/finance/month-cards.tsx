"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Currency } from "@prisma/client";
import { CalendarPlus, ChevronRight, FileSpreadsheet, Trash2 } from "lucide-react";
import { createLedgerMonth, deleteLedgerMonth } from "@/actions/ledger-month.actions";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { periodLabel, currentPeriod, formatPeriodKey } from "@/domain/finance/period";

export interface MonthCardData {
  key: string;
  year: number;
  month: number;
  total: number;
  settled: number;
  outstanding: number;
  rowCount: number;
  isEmpty: boolean;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * The month picker that replaced a flat list of every row ever entered.
 *
 * The workbook is organised one file per month, and people think in those
 * terms ("check August") — a single 200-row list made finding and editing
 * one entry a hunt. Each card is a month; opening it shows that month's
 * sheet.
 */
export function MonthCards({
  months,
  entityCode,
  currency,
  basePath,
  canWrite,
  totalLabel,
  settledLabel,
}: {
  months: MonthCardData[];
  entityCode: string;
  currency: Currency;
  /** e.g. "/operations/uae/inflow" */
  basePath: string;
  canWrite: boolean;
  totalLabel: string;
  settledLabel: string;
}) {
  const router = useRouter();
  const now = currentPeriod();
  const [creating, setCreating] = useState(false);
  const [year, setYear] = useState(now.year);
  const [month, setMonth] = useState(now.month);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // A few years either side of now — enough to open next month or backfill
  // last year, without a scrolling list of irrelevant decades.
  const years = [now.year - 2, now.year - 1, now.year, now.year + 1];

  function create() {
    setError(null);
    const key = formatPeriodKey({ year, month });
    startTransition(async () => {
      const result = await createLedgerMonth(entityCode, key);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setCreating(false);
      router.push(`${basePath}/${key}`);
    });
  }

  function remove(key: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteLedgerMonth(entityCode, key);
      if (!result.success) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex flex-wrap items-center gap-2">
          {creating ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2">
              <Select
                value={String(month)}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="h-9 w-36 text-sm"
                aria-label="Month"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </Select>
              <Select
                value={String(year)}
                onChange={(e) => setYear(Number(e.target.value))}
                className="h-9 w-28 text-sm"
                aria-label="Year"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
              <Button size="sm" onClick={create} disabled={pending}>
                {pending ? "Creating…" : "Create"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setError(null); }} disabled={pending}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => setCreating(true)} className="gap-1.5">
              <CalendarPlus className="h-4 w-4" />
              Create month
            </Button>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {months.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <FileSpreadsheet className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">No months yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {canWrite
              ? "Create a month to start entering rows, the same way you'd start a new sheet."
              : "Nothing has been entered for this entity yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {months.map((m) => {
            const pct = m.total > 0 ? m.settled / m.total : 0;
            const isCurrent = m.year === now.year && m.month === now.month;
            return (
              <div key={m.key} className="group relative">
                <Link
                  href={`${basePath}/${m.key}`}
                  className="block rounded-xl border border-border bg-card p-4 transition-ui hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{periodLabel({ year: m.year, month: m.month })}</p>
                      <p className="mt-0.5 text-metadata">
                        {m.rowCount === 0 ? "Empty" : `${m.rowCount} ${m.rowCount === 1 ? "entry" : "entries"}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isCurrent && <Badge variant="brand">Current</Badge>}
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>

                  {m.rowCount > 0 && (
                    <>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">{totalLabel}</p>
                          <p className="mt-0.5 font-medium tabular-nums">{formatMoney(m.total, currency)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{settledLabel}</p>
                          <p className="mt-0.5 font-medium tabular-nums text-success">{formatMoney(m.settled, currency)}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", pct >= 1 ? "bg-success" : "bg-brand")}
                            style={{ width: `${Math.min(Math.max(pct * 100, 0), 100)}%` }}
                          />
                        </div>
                        <span className="shrink-0 text-metadata tabular-nums">{(pct * 100).toFixed(0)}%</span>
                      </div>
                    </>
                  )}
                </Link>

                {/* Only offered for shells — a month with rows can't be
                    deleted here, and the action refuses it anyway. */}
                {canWrite && m.isEmpty && (
                  <button
                    type="button"
                    onClick={() => remove(m.key)}
                    disabled={pending}
                    aria-label={`Delete ${periodLabel({ year: m.year, month: m.month })}`}
                    title="Delete this empty month"
                    className="absolute right-2 top-11 rounded-md p-1 text-muted-foreground/50 opacity-0 transition-ui hover:bg-destructive-subtle hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
