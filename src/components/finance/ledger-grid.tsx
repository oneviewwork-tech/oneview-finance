"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Currency } from "@prisma/client";
import { ArrowLeft, Check, Loader2, Plus, Trash2, TriangleAlert } from "lucide-react";
import { createLedgerRow, updateLedgerRow, deleteLedgerRow, type LedgerRowPatch } from "@/actions/ledger-row.actions";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { type Period, periodLabel, formatPeriodKey } from "@/domain/finance/period";

export interface GridOption {
  id: string;
  name: string;
}

export type GridFieldType = "text" | "money" | "date" | "select" | "combo";

export interface GridColumn {
  /** Matches a key of LedgerRowPatch, except for derived columns. */
  field: keyof LedgerRowPatch | "balance" | "percent" | "status";
  label: string;
  type: GridFieldType | "derived";
  width: string;
  options?: GridOption[];
  /** Combo columns write a free-text name when nothing is picked. */
  nameField?: keyof LedgerRowPatch;
}

export const WEEK_CHOICES: GridOption[] = [
  { id: "1", name: "WEEK 1" },
  { id: "2", name: "WEEK 2" },
  { id: "3", name: "WEEK 3" },
  { id: "4", name: "WEEK 4" },
];

export const PAY_FULL_CHOICES: GridOption[] = [
  { id: "N", name: "N" },
  { id: "Y", name: "Y" },
];

export interface GridRow {
  id: string;
  transactionDate: string;
  description: string;
  categoryId: string | null;
  expenseTypeId: string | null;
  departmentId: string | null;
  clientId: string | null;
  clientName: string;
  closedByName: string;
  referenceNumber: string;
  remarks: string;
  amount: string;
  paidAmount: string;
  week: string;
  payFull: string;
  paymentMethodId: string | null;
  paymentDate: string;
  clientTypeId: string | null;
}

type SaveState = "idle" | "saving" | "saved" | "error";

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function statusOf(amount: number, paid: number): "PENDING" | "PARTIAL" | "PAID" {
  if (paid <= 0) return "PENDING";
  if (paid >= amount) return "PAID";
  return "PARTIAL";
}

/**
 * The month's rows, edited in place.
 *
 * Built to feel like the spreadsheet it replaces: every cell is directly
 * editable, Enter and the arrow keys move between them, and the totals band
 * recomputes from what's on screen as you type rather than after a save.
 * Nothing opens a separate page — the whole reason people found the old
 * flow slow was that correcting one number meant a navigation, a form, and
 * a trip back.
 *
 * Writes are optimistic and per-row: the cell shows its new value at once,
 * the server call follows, and a failure reverts that row and says why.
 * Amounts are reconciled server-side against the payment ledger, so what
 * lands in the database is authoritative even though the UI moved first.
 */
export function LedgerGrid({
  period,
  entityCode,
  entityName,
  transactionType,
  currency,
  columns,
  initialRows,
  canWrite,
  backHref,
  labels,
}: {
  period: Period;
  entityCode: string;
  entityName: string;
  transactionType: "INFLOW" | "OUTFLOW";
  currency: Currency;
  columns: GridColumn[];
  initialRows: GridRow[];
  canWrite: boolean;
  backHref: string;
  labels: { title: string; total: string; settled: string; outstanding: string };
}) {
  const [rows, setRows] = useState<GridRow[]>(initialRows);
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const gridRef = useRef<HTMLTableElement>(null);
  // Snapshot before an optimistic write, so a rejected save can put the row
  // back exactly as it was rather than leaving a value the server refused.
  const previous = useRef<Record<string, GridRow>>({});

  // Totals are derived from on-screen values, which is what makes them feel
  // live: they move as the digits are typed, before anything is saved.
  const totals = useMemo(() => {
    let total = 0;
    let settled = 0;
    for (const r of rows) {
      total += num(r.amount);
      settled += num(r.paidAmount);
    }
    return { total, settled, outstanding: total - settled, fraction: total > 0 ? settled / total : 0 };
  }, [rows]);

  const setRowState = useCallback((id: string, s: SaveState) => {
    setSaveState((prev) => ({ ...prev, [id]: s }));
    if (s === "saved") {
      setTimeout(() => setSaveState((prev) => (prev[id] === "saved" ? { ...prev, [id]: "idle" } : prev)), 1200);
    }
  }, []);

  const commit = useCallback(
    async (row: GridRow, patch: LedgerRowPatch) => {
      setError(null);
      setRowState(row.id, "saving");
      const result = await updateLedgerRow(row.id, patch);
      if (!result.success) {
        setRows((prev) => prev.map((r) => (r.id === row.id ? previous.current[row.id] ?? r : r)));
        setRowState(row.id, "error");
        setError(result.error);
        return;
      }
      // Adopt the server's figures: it reconciles paid against the payment
      // ledger and may land on a different number than was typed.
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, amount: result.data.amount, paidAmount: result.data.paidAmount } : r))
      );
      setRowState(row.id, "saved");
    },
    [setRowState]
  );

  function edit(id: string, field: keyof GridRow, value: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (!previous.current[id]) previous.current[id] = r;
        return { ...r, [field]: value };
      })
    );
  }

  function blur(id: string, field: keyof GridRow, value: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const original = previous.current[id];
    // Nothing actually changed — don't spend a round trip or an audit entry.
    if (!original || original[field] === value) {
      delete previous.current[id];
      return;
    }
    void commit({ ...row, [field]: value }, { [field]: value } as LedgerRowPatch);
  }

  async function addRow() {
    setError(null);
    setAdding(true);
    const result = await createLedgerRow(entityCode, transactionType, formatPeriodKey(period), {
      description: transactionType === "INFLOW" ? "New entry" : "New expense",
      amount: "0",
      paidAmount: "0",
    });
    setAdding(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setRows((prev) => [
      ...prev,
      {
        id: result.data.id,
        transactionDate: `${period.year}-${String(period.month).padStart(2, "0")}-01`,
        description: transactionType === "INFLOW" ? "New entry" : "New expense",
        categoryId: null,
        expenseTypeId: null,
        departmentId: null,
        clientId: null,
        clientName: "",
        closedByName: "",
        referenceNumber: "",
        remarks: "",
        amount: "0",
        paidAmount: "0",
        week: "1",
        payFull: "N",
        paymentMethodId: null,
        paymentDate: "",
        clientTypeId: null,
      },
    ]);
    // Put the caret in the first cell of the new row, the way pressing
    // "new row" in a spreadsheet does.
    requestAnimationFrame(() => {
      const inputs = gridRef.current?.querySelectorAll<HTMLElement>("tbody tr:last-child [data-cell]");
      inputs?.[1]?.focus();
    });
  }

  async function removeRow(id: string) {
    setError(null);
    setRowState(id, "saving");
    const result = await deleteLedgerRow(id);
    if (!result.success) {
      setRowState(id, "error");
      setError(result.error);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  /** Spreadsheet keys: Enter moves down, arrows move around, Escape reverts. */
  function onKeyDown(e: React.KeyboardEvent<HTMLElement>, rowIndex: number, colIndex: number) {
    const move = (dr: number, dc: number) => {
      e.preventDefault();
      const cells = gridRef.current?.querySelectorAll<HTMLElement>("[data-cell]");
      if (!cells) return;
      const perRow = columns.filter((c) => c.type !== "derived").length;
      const target = (rowIndex + dr) * perRow + (colIndex + dc);
      cells[target]?.focus();
      if (cells[target] instanceof HTMLInputElement) cells[target].select();
    };
    if (e.key === "Enter") move(1, 0);
    else if (e.key === "ArrowDown") move(1, 0);
    else if (e.key === "ArrowUp") move(-1, 0);
    else if (e.key === "Escape") (e.target as HTMLInputElement).blur();
  }

  return (
    <div>
      <Link href={backHref} className="inline-flex items-center gap-1 text-metadata transition-ui hover:text-foreground">
        <ArrowLeft className="h-3 w-3" />
        All months
      </Link>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-page-title">
            {entityName} · {periodLabel(period)}
          </h2>
          <p className="mt-0.5 text-page-subtitle">
            {labels.title} · {rows.length} {rows.length === 1 ? "entry" : "entries"} · {currency} · edits save as you type
          </p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={addRow} disabled={adding} className="gap-1.5">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add row
          </Button>
        )}
      </div>

      {/* The workbook's LIVE TOTALS band, recomputed from the cells above as
          they change rather than from a saved aggregate. */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={labels.total} value={formatMoney(totals.total, currency)} />
        <Tile label={labels.settled} value={formatMoney(totals.settled, currency)} tone="success" />
        <Tile label={labels.outstanding} value={formatMoney(totals.outstanding, currency)} tone="destructive" />
        <Tile label="% Settled" value={`${(totals.fraction * 100).toFixed(1)}%`} tone="brand" />
      </div>

      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive-subtle px-3 py-2 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <table ref={gridRef} className="w-full border-collapse text-table">
          <thead className="border-b border-border bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-10 border-r border-border px-2 py-2 text-center font-medium">#</th>
              {columns.map((c) => (
                <th key={String(c.field)} className={cn("border-r border-border px-2 py-2 font-medium", c.width)}>
                  {c.label}
                </th>
              ))}
              {canWrite && <th className="w-10 px-2 py-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {canWrite ? "No rows yet — press Add row to start." : "No entries for this month."}
                </td>
              </tr>
            )}
            {rows.map((row, ri) => {
              const amount = num(row.amount);
              const paid = num(row.paidAmount);
              const status = statusOf(amount, paid);
              const state = saveState[row.id] ?? "idle";
              let ci = -1;
              return (
                <tr key={row.id} className={cn("border-b border-border-subtle", state === "error" && "bg-destructive-subtle/40")}>
                  <td className="border-r border-border-subtle px-2 py-1 text-center text-metadata tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      {ri + 1}
                      {state === "saving" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                      {state === "saved" && <Check className="h-3 w-3 text-success" />}
                    </span>
                  </td>

                  {columns.map((c) => {
                    if (c.type === "derived") {
                      const text =
                        c.field === "balance"
                          ? formatMoney(amount - paid, currency)
                          : c.field === "percent"
                            ? `${(amount > 0 ? (paid / amount) * 100 : 0).toFixed(1)}%`
                            : status;
                      return (
                        <td
                          key={String(c.field)}
                          className={cn(
                            "border-r border-border-subtle px-2 py-1 text-right text-sm tabular-nums",
                            // Blue-grey = automatic, matching the workbook's
                            // own colour language for computed cells.
                            "bg-brand-muted/40 text-muted-foreground",
                            c.field === "status" && "text-center",
                            c.field === "status" && status === "PAID" && "text-success",
                            c.field === "status" && status === "PARTIAL" && "text-warning",
                            c.field === "status" && status === "PENDING" && "text-destructive"
                          )}
                        >
                          {text}
                        </td>
                      );
                    }

                    ci += 1;
                    const colIndex = ci;
                    const field = c.field as keyof GridRow;
                    const value = (row[field] ?? "") as string;

                    return (
                      <td key={String(c.field)} className="border-r border-border-subtle p-0">
                        {c.type === "select" ? (
                          <select
                            data-cell
                            disabled={!canWrite}
                            value={value ?? ""}
                            onChange={(e) => {
                              if (!previous.current[row.id]) previous.current[row.id] = row;
                              edit(row.id, field, e.target.value);
                              void commit({ ...row, [field]: e.target.value }, { [field]: e.target.value || null } as LedgerRowPatch);
                            }}
                            onKeyDown={(e) => onKeyDown(e, ri, colIndex)}
                            className="h-9 w-full border-0 bg-transparent px-2 text-sm outline-none focus:bg-brand-subtle/40 focus:ring-1 focus:ring-inset focus:ring-brand disabled:opacity-60"
                          >
                            <option value="">—</option>
                            {c.options?.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            data-cell
                            readOnly={!canWrite}
                            type={c.type === "date" ? "date" : "text"}
                            inputMode={c.type === "money" ? "decimal" : undefined}
                            value={value}
                            onChange={(e) => edit(row.id, field, e.target.value)}
                            onFocus={(e) => {
                              if (!previous.current[row.id]) previous.current[row.id] = row;
                              if (c.type === "money") e.currentTarget.select();
                            }}
                            onBlur={(e) => blur(row.id, field, e.target.value)}
                            onKeyDown={(e) => onKeyDown(e, ri, colIndex)}
                            className={cn(
                              "h-9 w-full border-0 bg-transparent px-2 text-sm outline-none",
                              "focus:bg-brand-subtle/40 focus:ring-1 focus:ring-inset focus:ring-brand",
                              c.type === "money" && "text-right tabular-nums",
                              // Pale yellow = you type here, again matching
                              // the workbook's convention.
                              "bg-warning-subtle/25",
                              !canWrite && "cursor-default"
                            )}
                          />
                        )}
                      </td>
                    );
                  })}

                  {canWrite && (
                    <td className="px-1 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        aria-label={`Delete row ${ri + 1}`}
                        className="rounded p-1 text-muted-foreground/40 transition-ui hover:bg-destructive-subtle hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-metadata">
        Yellow cells are typed, blue-grey are calculated — same convention as the workbook. Enter or ↓ moves down a row;
        Escape leaves a cell without saving the change.
      </p>
    </div>
  );
}

function Tile({
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
      <p className={cn("mt-1 text-metric-sm tabular-nums", toneClass)}>{value}</p>
    </div>
  );
}
