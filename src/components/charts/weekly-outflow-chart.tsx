"use client";

import { useRef } from "react";
import { STATUS_CHART_COLORS } from "@/lib/chart-palette";
import { ChartTooltip, useChartTooltip } from "./chart-tooltip";

export interface WeeklyBarDatum {
  label: string;
  paid: number;
  pending: number;
  formattedPaid: string;
  formattedPending: string;
  formattedTotal: string;
}

// Fixed viewBox that the SVG scales to fill its container, so the chart
// uses the whole card instead of hugging the left edge. Bar thickness is
// capped in user units and centred within each slot.
const SVG_WIDTH = 520;
const MAX_BAR_WIDTH = 44;
const SEGMENT_GAP = 3;
const CORNER_RADIUS = 5;
const PLOT_HEIGHT = 190;
const SVG_HEIGHT = PLOT_HEIGHT + 34;

function topRoundedRect(x: number, y: number, width: number, height: number, radius: number) {
  if (height <= 0) return "";
  const r = Math.min(radius, height, width / 2);
  return `M ${x} ${y + height} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} L ${x + width - r} ${y} Q ${x + width} ${y} ${x + width} ${y + r} L ${x + width} ${y + height} Z`;
}

/** Paid (bottom, success green) + Pending (top, muted) stacked per week — answers "how much of this week's outflow is settled." */
export function WeeklyOutflowChart({ data }: { data: WeeklyBarDatum[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { tooltip, setTooltip } = useChartTooltip();
  const maxTotal = Math.max(...data.map((d) => d.paid + d.pending), 1);
  const width = SVG_WIDTH;
  const slotWidth = width / Math.max(data.length, 1);
  const barWidth = Math.min(MAX_BAR_WIDTH, slotWidth * 0.5);
  const scale = (v: number) => (v / maxTotal) * PLOT_HEIGHT;

  function showTooltip(d: WeeklyBarDatum, svgX: number, svgY: number) {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;
    const containerRect = container.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    const pxScaleX = svgRect.width / width;
    const pxScaleY = svgRect.height / SVG_HEIGHT;

    setTooltip({
      x: svgRect.left - containerRect.left + svgX * pxScaleX,
      y: svgRect.top - containerRect.top + svgY * pxScaleY,
      title: d.label,
      rows: [
        { label: "Paid", value: d.formattedPaid, color: STATUS_CHART_COLORS.PAID },
        { label: "Pending", value: d.formattedPending, color: "var(--muted-foreground)" },
        { label: "Total due", value: d.formattedTotal },
      ],
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${SVG_HEIGHT}`}
        className="h-auto w-full"
      >
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={0}
            x2={width}
            y1={PLOT_HEIGHT * t}
            y2={PLOT_HEIGHT * t}
            stroke="var(--border-subtle)"
            strokeWidth={1}
          />
        ))}
        <line x1={0} y1={PLOT_HEIGHT} x2={width} y2={PLOT_HEIGHT} stroke="var(--border)" strokeWidth={1} />
        {data.map((d, i) => {
          const barCenterX = slotWidth * i + slotWidth / 2;
          const x = barCenterX - barWidth / 2;
          const paidH = scale(d.paid);
          const pendingH = scale(d.pending);
          const paidY = PLOT_HEIGHT - paidH;
          const hasPending = d.pending > 0;
          const pendingSegH = Math.max(pendingH - SEGMENT_GAP, 0);
          const pendingY = paidY - SEGMENT_GAP - pendingSegH;
          const topY = hasPending ? pendingY : paidY;
          const isHovered = tooltip?.title === d.label;

          return (
            <g
              key={d.label}
              onMouseEnter={() => showTooltip(d, barCenterX, topY)}
              onMouseLeave={() => setTooltip(null)}
              onFocus={() => showTooltip(d, barCenterX, topY)}
              onBlur={() => setTooltip(null)}
              tabIndex={0}
              className="cursor-pointer outline-none"
              style={{ opacity: tooltip === null || isHovered ? 1 : 0.5 }}
            >
              {hasPending ? (
                <>
                  <rect x={x} y={paidY} width={barWidth} height={paidH} fill={STATUS_CHART_COLORS.PAID} />
                  <path
                    d={topRoundedRect(x, pendingY, barWidth, pendingSegH, CORNER_RADIUS)}
                    fill="var(--muted-foreground)"
                    opacity={0.35}
                  />
                </>
              ) : (
                <path d={topRoundedRect(x, paidY, barWidth, paidH, CORNER_RADIUS)} fill={STATUS_CHART_COLORS.PAID} />
              )}
              <text x={barCenterX} y={PLOT_HEIGHT + 16} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                {d.label.replace("WEEK ", "W")}
              </text>
            </g>
          );
        })}
      </svg>
      <ChartTooltip tooltip={tooltip} />
      <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_CHART_COLORS.PAID }} />
          Paid
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/35" />
          Pending
        </span>
      </div>
    </div>
  );
}
