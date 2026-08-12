"use client";

import { useId, useRef } from "react";
import { cn } from "@/lib/utils";
import { ChartTooltip, useChartTooltip } from "./chart-tooltip";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
  formattedValue: string;
}

/**
 * Ring donut with a 3px surface-gap between segments (per the dataviz
 * skill's spacer rule — the gap separates marks, never a border) and
 * rounded stroke caps. Legend below doubles as the accessible "table"
 * fallback: every value is readable without hovering.
 */
export function DonutChart({
  segments,
  centerLabel,
  centerValue,
  size = 180,
}: {
  segments: DonutSegment[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
}) {
  const gradientId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { tooltip, setTooltip } = useChartTooltip();
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const hoveredIndex = segments.findIndex((s) => s.label === tooltip?.title);
  const hovered = hoveredIndex === -1 ? null : hoveredIndex;

  const strokeWidth = 22;
  const r = size / 2 - strokeWidth / 2 - 2;
  const circumference = 2 * Math.PI * r;
  const gapPx = 3;

  let cumulative = 0;
  const arcs = segments.map((seg, i) => {
    const fraction = total === 0 ? 0 : seg.value / total;
    const arcLength = fraction * circumference;
    const dashLength = Math.max(arcLength - gapPx, 0);
    const dashArray = `${dashLength} ${circumference - dashLength}`;
    const dashOffset = -cumulative;
    const midCumulative = cumulative + arcLength / 2;
    cumulative += arcLength;
    const angleRad = (midCumulative / circumference) * 2 * Math.PI - Math.PI / 2;
    const midX = size / 2 + r * Math.cos(angleRad);
    const midY = size / 2 + r * Math.sin(angleRad);
    return { ...seg, dashArray, dashOffset, index: i, fraction, midX, midY };
  });

  function showTooltip(arc: (typeof arcs)[number]) {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;
    const containerRect = container.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    const pxScale = svgRect.width / size;

    setTooltip({
      x: svgRect.left - containerRect.left + arc.midX * pxScale,
      y: svgRect.top - containerRect.top + arc.midY * pxScale,
      title: arc.label,
      rows: [
        { label: arc.label, value: arc.formattedValue, color: arc.color },
        { label: "Share", value: `${(arc.fraction * 100).toFixed(1)}%` },
      ],
    });
  }

  return (
    <div ref={containerRef} className="relative flex items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg ref={svgRef} width={size} height={size} viewBox={`0 0 ${size} ${size}`} id={gradientId}>
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {total === 0 ? (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke="var(--muted)"
                strokeWidth={strokeWidth}
              />
            ) : (
              arcs.map((arc) => (
                <circle
                  key={arc.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={arc.dashArray}
                  strokeDashoffset={arc.dashOffset}
                  onMouseEnter={() => showTooltip(arc)}
                  onMouseLeave={() => setTooltip(null)}
                  onFocus={() => showTooltip(arc)}
                  onBlur={() => setTooltip(null)}
                  tabIndex={0}
                  className="cursor-pointer transition-opacity outline-none"
                  style={{ opacity: hovered === null || hovered === arc.index ? 1 : 0.45 }}
                />
              ))
            )}
          </g>
        </svg>
        {(centerLabel || centerValue) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {centerValue && <span className="text-metric-sm">{centerValue}</span>}
            {centerLabel && <span className="text-metadata">{centerLabel}</span>}
          </div>
        )}
        <ChartTooltip tooltip={tooltip} />
      </div>

      <ul className="space-y-1.5 text-sm">
        {segments.map((seg, i) => (
          <li
            key={seg.label}
            className={cn("flex items-center gap-2 transition-ui", hovered !== null && hovered !== i && "opacity-45")}
            onMouseEnter={() => showTooltip(arcs[i])}
            onMouseLeave={() => setTooltip(null)}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-muted-foreground">{seg.label}</span>
            <span className="ml-auto font-medium tabular-nums">{seg.formattedValue}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
