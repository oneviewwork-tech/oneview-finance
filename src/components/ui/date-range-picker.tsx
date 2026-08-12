"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import type { DateRangePreset, RangeSelection } from "@/domain/finance/date-range";
import { describeSelection, recentMonths } from "@/domain/finance/date-range";
import { MenuDivider, MenuItem, MenuSectionLabel, PopoverMenu } from "@/components/ui/popover-menu";
import { Button } from "@/components/ui/button";

const PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: "TODAY", label: "Today" },
  { value: "THIS_WEEK", label: "This Week" },
  { value: "THIS_MONTH", label: "This Month" },
  { value: "LAST_MONTH", label: "Last Month" },
  { value: "THIS_QUARTER", label: "This Quarter" },
  { value: "THIS_YEAR", label: "This Year" },
];

function toInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Presets, a specific calendar month, and a custom span in one control.
 * Presets are rows (nobody fights a calendar grid for "last 30 days") and
 * the custom range sits behind a hairline in the footer.
 */
export function DateRangePicker({
  selection,
  onChange,
  monthsToList = 12,
}: {
  selection: RangeSelection;
  onChange: (next: RangeSelection) => void;
  monthsToList?: number;
}) {
  const [tab, setTab] = useState<"presets" | "months" | "custom">(
    selection.kind === "month" ? "months" : selection.kind === "custom" ? "custom" : "presets"
  );
  const [customFrom, setCustomFrom] = useState(
    selection.kind === "custom" ? toInputValue(selection.from) : ""
  );
  const [customTo, setCustomTo] = useState(selection.kind === "custom" ? toInputValue(selection.to) : "");
  const [error, setError] = useState<string | null>(null);

  const months = recentMonths(monthsToList);

  return (
    <PopoverMenu
      label={describeSelection(selection)}
      icon={<CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
      panelClassName="w-72"
    >
      {(close) => (
        <div>
          <div className="flex gap-0.5 border-b border-border p-1">
            {(
              [
                ["presets", "Presets"],
                ["months", "Month"],
                ["custom", "Custom"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={
                  tab === value
                    ? "flex-1 rounded-[5px] bg-secondary px-2 py-1 text-xs font-medium text-foreground transition-ui"
                    : "flex-1 rounded-[5px] px-2 py-1 text-xs text-muted-foreground transition-ui hover:bg-accent"
                }
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "presets" && (
            <div className="py-1">
              {PRESETS.map((p) => (
                <MenuItem
                  key={p.value}
                  selected={selection.kind === "preset" && selection.preset === p.value}
                  onClick={() => {
                    onChange({ kind: "preset", preset: p.value });
                    close();
                  }}
                >
                  {p.label}
                </MenuItem>
              ))}
            </div>
          )}

          {tab === "months" && (
            <div className="max-h-72 overflow-y-auto py-1">
              <MenuSectionLabel>Select a month</MenuSectionLabel>
              {months.map((m) => (
                <MenuItem
                  key={`${m.year}-${m.month}`}
                  selected={selection.kind === "month" && selection.year === m.year && selection.month === m.month}
                  onClick={() => {
                    onChange({ kind: "month", year: m.year, month: m.month });
                    close();
                  }}
                >
                  {m.label}
                </MenuItem>
              ))}
            </div>
          )}

          {tab === "custom" && (
            <div className="p-2.5">
              <MenuDivider />
              <div className="space-y-2">
                <div>
                  <label htmlFor="range-from" className="text-metadata">
                    From
                  </label>
                  <input
                    id="range-from"
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="mt-0.5 h-8 w-full rounded-md border border-input bg-card px-2 text-[0.8125rem] shadow-xs focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label htmlFor="range-to" className="text-metadata">
                    To
                  </label>
                  <input
                    id="range-to"
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="mt-0.5 h-8 w-full rounded-md border border-input bg-card px-2 text-[0.8125rem] shadow-xs focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    if (!customFrom || !customTo) {
                      setError("Pick both a start and an end date.");
                      return;
                    }
                    setError(null);
                    const [fy, fm, fd] = customFrom.split("-").map(Number);
                    const [ty, tm, td] = customTo.split("-").map(Number);
                    onChange({
                      kind: "custom",
                      from: new Date(Date.UTC(fy, fm - 1, fd)),
                      to: new Date(Date.UTC(ty, tm - 1, td)),
                    });
                    close();
                  }}
                >
                  Apply range
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </PopoverMenu>
  );
}
