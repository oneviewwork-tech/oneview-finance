"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { RangeSelection } from "@/domain/finance/date-range";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { MenuItem, PopoverMenu } from "@/components/ui/popover-menu";

const ENTITY_OPTIONS = [
  { value: "ALL", label: "Combined" },
  { value: "UAE", label: "UAE" },
  { value: "INDIA", label: "India" },
];

const CURRENCY_OPTIONS = [
  { value: "INR", label: "INR", hint: "Indian Rupee" },
  { value: "AED", label: "AED", hint: "UAE Dirham" },
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** One row of filters above everything they scope, per the dataviz skill's composition rule — every chart/stat/table below re-renders against the same slice. */
export function IntelligenceFilters({
  entity,
  currency,
  selection,
  showCurrency,
}: {
  entity: string;
  currency: string;
  selection: RangeSelection;
  showCurrency: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function push(mutate: (p: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    router.push(`${pathname}?${params.toString()}`);
  }

  function setRange(next: RangeSelection) {
    push((params) => {
      // Clear the params that belong to the other range kinds so a stale
      // month=/from= never lingers and silently wins on the next parse.
      params.delete("month");
      params.delete("from");
      params.delete("to");
      if (next.kind === "preset") {
        params.set("range", next.preset);
      } else if (next.kind === "month") {
        params.set("range", "MONTH");
        params.set("month", `${next.year}-${pad(next.month)}`);
      } else {
        params.set("range", "CUSTOM");
        params.set("from", next.from.toISOString().slice(0, 10));
        params.set("to", next.to.toISOString().slice(0, 10));
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl options={ENTITY_OPTIONS} value={entity} onSelect={(v) => push((p) => p.set("entity", v))} />

      {showCurrency && (
        <PopoverMenu label={`Reporting: ${currency}`} panelClassName="w-48">
          {(close) =>
            CURRENCY_OPTIONS.map((opt) => (
              <MenuItem
                key={opt.value}
                selected={currency === opt.value}
                onClick={() => {
                  push((p) => p.set("currency", opt.value));
                  close();
                }}
              >
                <span className="flex flex-col">
                  <span>{opt.label}</span>
                  <span className="text-metadata">{opt.hint}</span>
                </span>
              </MenuItem>
            ))
          }
        </PopoverMenu>
      )}

      <DateRangePicker selection={selection} onChange={setRange} />
    </div>
  );
}
