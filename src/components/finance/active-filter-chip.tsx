import Link from "next/link";
import { X } from "lucide-react";

/**
 * Shows that a list is filtered and offers one click to clear it.
 *
 * Arriving from a dashboard tile into a pre-filtered list is disorienting
 * without this — the counts don't match the page you came from and there's
 * nothing explaining why. The chip states the filter and how to remove it.
 */
export function ActiveFilterChip({ label, clearHref }: { label: string; clearHref: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-metadata">Filtered:</span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand-subtle px-2.5 py-1 text-xs font-medium text-brand">
        {label}
        <Link
          href={clearHref}
          aria-label="Clear filter"
          className="rounded-full p-0.5 transition-ui hover:bg-brand/15"
        >
          <X className="h-3 w-3" />
        </Link>
      </span>
    </div>
  );
}
