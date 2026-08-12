import { cn } from "@/lib/utils";

/** Tiny inline trend line for KPI cards. Purely supporting context, never the primary read. */
export function Sparkline({
  values,
  className,
  stroke = "currentColor",
  width = 88,
  height = 28,
}: {
  values: number[];
  className?: string;
  stroke?: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  const pad = 3;
  const plotH = height - pad * 2;

  const points = values.map((v, i) => [i * stepX, pad + plotH - ((v - min) / span) * plotH] as const);
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;
  const last = points[points.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn("overflow-visible", className)} aria-hidden="true">
      <path d={area} fill="currentColor" opacity={0.12} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={stroke} />
    </svg>
  );
}
