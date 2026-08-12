import Link from "next/link";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import type { FxBannerContext } from "@/services/finance/combined";

const STALE_AFTER_DAYS = 2;

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

/** The spec is explicit: combined/converted values must never hide that a conversion happened, nor hide that a rate might be out of date. */
export function FxBanner({ context }: { context: FxBannerContext }) {
  if (!context.available) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-destructive/25 bg-destructive-subtle px-3.5 py-2.5 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          Exchange rate unavailable for this period. Combined totals can&rsquo;t be shown until a rate is set.
        </span>
        <Link href="/intelligence/fx" className="ml-auto shrink-0 font-medium underline underline-offset-2">
          Set a rate
        </Link>
      </div>
    );
  }

  const isManual = context.source === "MANUAL";
  const age = daysSince(context.rateDate!);
  const isStale = !isManual && age > STALE_AFTER_DAYS;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-3.5 py-2.5">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <span className="text-muted-foreground">AED</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <span className="text-muted-foreground">INR</span>
        <span className="ml-1 tabular-nums">1 AED = ₹{context.aedToInrRate?.toFixed(4)}</span>
      </div>

      <Badge variant={isManual ? "brand" : isStale ? "warning" : "success"} dot>
        {isManual ? "Manual rate applied" : isStale ? "Live rate, may be outdated" : "Live rate"}
      </Badge>

      <span className="text-metadata">Updated {formatDate(context.rateDate!)}</span>

      <Link href="/intelligence/fx" className="ml-auto shrink-0 text-label font-medium text-brand transition-ui hover:underline">
        Manage rate
      </Link>
    </div>
  );
}
