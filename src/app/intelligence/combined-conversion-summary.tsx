import { ArrowRight } from "lucide-react";
import type { Currency } from "@prisma/client";
import { formatMoney } from "@/lib/format";
import { Card } from "@/components/ui/card";
import type { CombinedSummaryResult } from "@/services/finance/combined";

/**
 * The spec's explicit worked example: India stays native, UAE gets
 * converted (or vice versa), and the "≈" makes the conversion impossible
 * to miss. Uses Total Inflow as the headline figure — the first thing the
 * spec says management wants to know.
 */
export function CombinedConversionSummary({ result, currency }: { result: CombinedSummaryResult; currency: Currency }) {
  if (!result.combined.available) return null;

  return (
    <Card className="border-brand/20 bg-brand-subtle/40 p-0">
      <div className="grid grid-cols-1 divide-y divide-brand/15 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {result.rows.map((row) => (
          <div key={row.native.entityCode} className="px-4 py-3.5">
            <p className="text-card-title">{row.native.entityName} · Total Inflow</p>
            <p className="mt-1 text-metric-sm">{formatMoney(row.native.totalInflow, row.native.currency as Currency)}</p>
            {row.native.currency !== currency && (
              <p className="mt-0.5 flex items-center gap-1 text-metadata">
                <ArrowRight className="h-3 w-3" />≈ {formatMoney(row.converted.totalInflow, currency)}
              </p>
            )}
          </div>
        ))}
        <div className="bg-brand/5 px-4 py-3.5 sm:col-span-1">
          <p className="text-card-title">Combined · Total Inflow</p>
          <p className="mt-1 text-metric-sm text-brand">{formatMoney(result.combined.totalInflow, currency)}</p>
          <p className="mt-0.5 text-metadata">in {currency}</p>
        </div>
      </div>
    </Card>
  );
}
