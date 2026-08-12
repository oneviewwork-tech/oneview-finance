"use client";

import { useState } from "react";

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

export interface TooltipState {
  x: number;
  y: number;
  title: string;
  rows: TooltipRow[];
}

/** Shared floating tooltip — dark surface, title + label:value rows, value leads (bold) per the dataviz interaction spec. Positioned by the chart via pointer coordinates. */
export function ChartTooltip({ tooltip }: { tooltip: TooltipState | null }) {
  if (!tooltip) return null;
  return (
    <div
      className="pointer-events-none absolute z-30 min-w-32 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-foreground px-2.5 py-2 shadow-lg transition-ui"
      style={{ left: tooltip.x, top: tooltip.y - 8 }}
    >
      <p className="text-[0.6875rem] font-medium text-background/70">{tooltip.title}</p>
      <div className="mt-1 space-y-0.5">
        {tooltip.rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-background/80">
              {row.color && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />}
              {row.label}
            </span>
            <span className="font-semibold tabular-nums text-background">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Local hover-tooltip state, shared shape across chart components. */
export function useChartTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  return { tooltip, setTooltip };
}
