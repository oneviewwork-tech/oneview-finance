import { cn } from "@/lib/utils";

export interface SegmentedControlOption {
  value: string;
  label: string;
}

/** A compact, professional-analytics-tool tab group — not a styled `<select>`, not oversized pills. */
export function SegmentedControl({
  options,
  value,
  onSelect,
  size = "default",
}: {
  options: SegmentedControlOption[];
  value: string;
  onSelect: (value: string) => void;
  size?: "default" | "sm";
}) {
  return (
    <div
      role="tablist"
      className="inline-flex items-center gap-0.5 rounded-md border border-border bg-secondary/60 p-0.5"
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(opt.value)}
            className={cn(
              "rounded-[5px] font-medium transition-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
              selected
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
