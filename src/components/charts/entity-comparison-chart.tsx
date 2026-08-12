"use client";

import { useRef } from "react";
import { CATEGORICAL_PALETTE } from "@/lib/chart-palette";
import { ChartTooltip, useChartTooltip } from "./chart-tooltip";

export interface ComparisonMetric {
  label: string;
  values: { entityCode: string; value: number; formattedValue: string }[];
}

const BAR_HEIGHT = 18;
const BAR_GAP = 5;
const GROUP_GAP = 22;
const LABEL_WIDTH = 110;
// Value labels are drawn inside the SVG, so the plot has to stop short of
// the right edge or long currency strings get clipped by the viewBox.
const VALUE_GUTTER = 150;
const SVG_WIDTH = 720;
const PLOT_WIDTH = SVG_WIDTH - LABEL_WIDTH - VALUE_GUTTER;

/** Grouped horizontal bars comparing UAE vs India across a few headline metrics, in the selected reporting currency. */
export function EntityComparisonChart({ metrics, entityCodes }: { metrics: ComparisonMetric[]; entityCodes: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { tooltip, setTooltip } = useChartTooltip();
  const allValues = metrics.flatMap((m) => m.values.map((v) => Math.abs(v.value)));
  const maxValue = Math.max(...allValues, 1);
  const colorByEntity = new Map(entityCodes.map((code, i) => [code, CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]]));
  const svgWidth = SVG_WIDTH;

  const groupHeight = entityCodes.length * BAR_HEIGHT + (entityCodes.length - 1) * BAR_GAP;
  const totalHeight = metrics.length * groupHeight + (metrics.length - 1) * GROUP_GAP + 8;

  function showTooltip(metric: ComparisonMetric, svgX: number, svgY: number) {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;
    const containerRect = container.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    const pxScaleX = svgRect.width / svgWidth;
    const pxScaleY = svgRect.height / totalHeight;

    setTooltip({
      x: svgRect.left - containerRect.left + svgX * pxScaleX,
      y: svgRect.top - containerRect.top + svgY * pxScaleY,
      title: metric.label,
      rows: metric.values.map((v) => ({ label: v.entityCode, value: v.formattedValue, color: colorByEntity.get(v.entityCode) })),
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <svg ref={svgRef} viewBox={`0 0 ${svgWidth} ${totalHeight}`} className="h-auto w-full">
        {metrics.map((metric, mi) => {
          const groupY = mi * (groupHeight + GROUP_GAP);
          const isHovered = tooltip?.title === metric.label;
          return (
            <g
              key={metric.label}
              onMouseEnter={() => showTooltip(metric, LABEL_WIDTH + PLOT_WIDTH / 2, groupY)}
              onMouseLeave={() => setTooltip(null)}
              onFocus={() => showTooltip(metric, LABEL_WIDTH + PLOT_WIDTH / 2, groupY)}
              onBlur={() => setTooltip(null)}
              tabIndex={0}
              className="cursor-pointer outline-none"
              style={{ opacity: tooltip === null || isHovered ? 1 : 0.55 }}
            >
              <text x={LABEL_WIDTH - 8} y={groupY + groupHeight / 2 + 4} textAnchor="end" className="fill-muted-foreground text-xs">
                {metric.label}
              </text>
              {metric.values.map((v, vi) => {
                const barY = groupY + vi * (BAR_HEIGHT + BAR_GAP);
                const barLength = (Math.abs(v.value) / maxValue) * PLOT_WIDTH;
                return (
                  <g key={`${metric.label}-${v.entityCode}`}>
                    <rect
                      x={LABEL_WIDTH}
                      y={barY}
                      width={Math.max(barLength, 2)}
                      height={BAR_HEIGHT}
                      rx={4}
                      fill={colorByEntity.get(v.entityCode)}
                    />
                    <text
                      x={LABEL_WIDTH + Math.max(barLength, 2) + 8}
                      y={barY + BAR_HEIGHT / 2 + 4}
                      className="fill-foreground text-xs font-medium tabular-nums"
                    >
                      {v.formattedValue}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <ChartTooltip tooltip={tooltip} />
      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        {entityCodes.map((code) => (
          <span key={code} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorByEntity.get(code) }} />
            {code}
          </span>
        ))}
      </div>
    </div>
  );
}
