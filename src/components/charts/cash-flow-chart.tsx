"use client";

import { useRef, useState } from "react";
import { STATUS_CHART_COLORS } from "@/lib/chart-palette";

export interface CashFlowPoint {
  label: string;
  inflow: number;
  outflow: number;
  formattedInflow: string;
  formattedOutflow: string;
  formattedNet: string;
}

// Wide aspect ratio: the SVG scales by width, so a taller viewBox would
// make the card disproportionately tall on desktop.
const H = 230;
const PAD_TOP = 18;
const PAD_BOTTOM = 30;
const PAD_LEFT = 8;
const PLOT_H = H - PAD_TOP - PAD_BOTTOM;
const OUTFLOW_COLOR = "#7c3aed"; // violet-600 — matches the Finance View accent family (this chart is Finance View-only)

/** Inflow vs Outflow-paid over time, with a crosshair that reads out both series plus net at the hovered month. */
export function CashFlowChart({ data }: { data: CashFlowPoint[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  // Fixed viewBox width; the SVG scales fluidly via CSS so this stays
  // responsive without a resize observer.
  const width = 1100;

  const max = Math.max(...data.flatMap((d) => [d.inflow, d.outflow]), 1);
  const stepX = data.length > 1 ? (width - PAD_LEFT * 2) / (data.length - 1) : 0;
  const xAt = (i: number) => PAD_LEFT + i * stepX;
  const yAt = (v: number) => PAD_TOP + PLOT_H - (v / max) * PLOT_H;

  function linePath(key: "inflow" | "outflow") {
    return data.map((d, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(d[key])}`).join(" ");
  }
  function areaPath(key: "inflow" | "outflow") {
    if (data.length === 0) return "";
    return `${linePath(key)} L ${xAt(data.length - 1)} ${PAD_TOP + PLOT_H} L ${xAt(0)} ${PAD_TOP + PLOT_H} Z`;
  }

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    const idx = Math.max(0, Math.min(data.length - 1, Math.round((relX - PAD_LEFT) / (stepX || 1))));
    setActive(idx);
  }

  const point = active !== null ? data[active] : null;

  return (
    <div ref={wrapRef} className="relative w-full">
      {/* h-auto (no fixed height) so the SVG scales by width; a fixed height
          with the default preserveAspectRatio letterboxes it in the middle. */}
      <svg
        viewBox={`0 0 ${width} ${H}`}
        className="h-auto w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setActive(null)}
        onFocus={() => setActive(0)}
        onBlur={() => setActive(null)}
        tabIndex={0}
        role="img"
        aria-label="Inflow versus outflow paid by month"
      >
        <defs>
          {/* Area fills are a ~10% wash, never a saturated block — the lines
              carry the reading, the fill only hints at volume. */}
          <linearGradient id="inflowFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={STATUS_CHART_COLORS.PAID} stopOpacity="0.10" />
            <stop offset="100%" stopColor={STATUS_CHART_COLORS.PAID} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="outflowFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={OUTFLOW_COLOR} stopOpacity="0.10" />
            <stop offset="100%" stopColor={OUTFLOW_COLOR} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((t) => (
          <line
            key={t}
            x1={0}
            x2={width}
            y1={PAD_TOP + PLOT_H * t}
            y2={PAD_TOP + PLOT_H * t}
            stroke="var(--border)"
            strokeWidth={1}
          />
        ))}

        <path d={areaPath("inflow")} fill="url(#inflowFill)" />
        <path d={areaPath("outflow")} fill="url(#outflowFill)" />
        <path d={linePath("outflow")} fill="none" stroke={OUTFLOW_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path
          d={linePath("inflow")}
          fill="none"
          stroke={STATUS_CHART_COLORS.PAID}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {active !== null && (
          <>
            <line x1={xAt(active)} x2={xAt(active)} y1={PAD_TOP} y2={PAD_TOP + PLOT_H} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={xAt(active)} cy={yAt(data[active].inflow)} r={4.5} fill={STATUS_CHART_COLORS.PAID} stroke="var(--card)" strokeWidth={2} />
            <circle cx={xAt(active)} cy={yAt(data[active].outflow)} r={4.5} fill={OUTFLOW_COLOR} stroke="var(--card)" strokeWidth={2} />
          </>
        )}

        {data.map((d, i) => (
          <text
            key={d.label}
            x={xAt(i)}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
            className="fill-muted-foreground text-[10px]"
          >
            {d.label}
          </text>
        ))}
      </svg>

      {point && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-36 -translate-x-1/2 rounded-xl border border-border bg-foreground px-2.5 py-2 shadow-lg"
          style={{ left: `${(xAt(active!) / width) * 100}%` }}
        >
          <p className="text-[0.6875rem] font-medium text-background/70">{point.label}</p>
          <div className="mt-1 space-y-0.5 text-xs">
            <Row color={STATUS_CHART_COLORS.PAID} label="Inflow" value={point.formattedInflow} />
            <Row color={OUTFLOW_COLOR} label="Outflow paid" value={point.formattedOutflow} />
            <div className="mt-1 flex items-center justify-between gap-3 border-t border-background/15 pt-1">
              <span className="text-background/80">Net</span>
              <span className="font-semibold tabular-nums text-background">{point.formattedNet}</span>
            </div>
          </div>
        </div>
      )}

      <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_CHART_COLORS.PAID }} />
          Inflow received
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: OUTFLOW_COLOR }} />
          Outflow paid
        </span>
      </div>
    </div>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-background/80">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className="font-semibold tabular-nums text-background">{value}</span>
    </div>
  );
}
