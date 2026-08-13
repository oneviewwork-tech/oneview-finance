import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Info } from "lucide-react";
import type { Currency } from "@prisma/client";
import { requireUser, canViewIntelligenceEntity, canAccessOperations } from "@/lib/rbac";
import { formatMoney, formatDate } from "@/lib/format";
import { entitySlug } from "@/lib/entities";
import { parseRangeSelection, resolveSelection, describeSelectionLong } from "@/domain/finance/date-range";
import { parseCombinedMetric, isMoneyMetric } from "@/domain/finance/combined-metrics";
import { getCombinedSummary } from "@/services/finance/combined";
import { ensureTodayLiveRate } from "@/services/fx/exchange-rate.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * "Where does this combined number come from?"
 *
 * The Combined dashboard sums two entities that keep their books in different
 * currencies, so a single total hides both the split and the conversion. This
 * page shows each entity in its own currency, what it became after
 * conversion, and the rate that did it — then points at the underlying
 * records.
 */
export default async function BreakdownPage({
  searchParams,
}: {
  searchParams: Promise<{ metric?: string; currency?: string; range?: string; month?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();

  // This page only exists for the combined view, which entity-scoped roles
  // can't see at all.
  if (!canViewIntelligenceEntity(user.role, "ALL")) notFound();

  const metric = parseCombinedMetric(params.metric);
  if (!metric) notFound();
  // Narrowed once here so every read below is type-checked rather than cast.
  const moneyKey = isMoneyMetric(metric) ? metric.key : null;

  const currency: Currency = params.currency === "AED" ? "AED" : "INR";
  const selection = parseRangeSelection(params);
  const range = resolveSelection(selection);
  const rangeLabel = describeSelectionLong(selection);

  await ensureTodayLiveRate();
  const combined = await getCombinedSummary(currency, range);

  // Carry the current filters back to the dashboard so returning doesn't
  // silently reset the period the user was looking at.
  const backQs = new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string] => e[0] !== "metric" && typeof e[1] === "string")
  );
  const backHref = `/intelligence${backQs.toString() ? `?${backQs}` : ""}`;

  const showOpsLinks = canAccessOperations(user.role);
  const combinedAvailable = combined.combined.available;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-metadata transition-ui hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Finance View
        </Link>
        <h1 className="mt-1 text-page-title">{metric.label}</h1>
        <p className="mt-0.5 text-page-subtitle">
          {metric.description} {rangeLabel}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By entity</CardTitle>
          <CardDescription>
            {metric.isMoney
              ? `Each entity in its own currency, and the same figure converted to ${currency}.`
              : "A count — not converted, since currency doesn't apply."}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-table">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2 font-medium">Entity</th>
                <th className="py-2 text-right font-medium">Native</th>
                {metric.isMoney && <th className="py-2 text-right font-medium">Rate</th>}
                {metric.isMoney && <th className="py-2 text-right font-medium">In {currency}</th>}
                {showOpsLinks && <th className="py-2 text-right font-medium" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {combined.rows.map((row) => {
                const nativeCurrency = row.native.currency as Currency;
                const slug = entitySlug(row.native.entityCode);
                const recordsHref = metric.recordsPath?.(slug);
                return (
                  <tr key={row.native.entityCode} className="hover:bg-accent/40">
                    <td className="py-2.5">
                      <span className="font-medium">{row.native.entityName}</span>{" "}
                      <span className="text-metadata">({nativeCurrency})</span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {moneyKey
                        ? formatMoney(row.native[moneyKey], nativeCurrency)
                        : String(row.native.clientsClosed)}
                    </td>
                    {metric.isMoney && (
                      <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                        {nativeCurrency === currency
                          ? "—"
                          : row.converted.available && row.converted.rate
                            ? row.converted.rate.toFixed(4)
                            : "unavailable"}
                      </td>
                    )}
                    {metric.isMoney && (
                      <td className="py-2.5 text-right font-medium tabular-nums">
                        {row.converted.available && moneyKey
                          ? formatMoney(row.converted[moneyKey], currency)
                          : "—"}
                      </td>
                    )}
                    {showOpsLinks && (
                      <td className="py-2.5 text-right">
                        {recordsHref && (
                          <Link
                            href={recordsHref}
                            className="inline-flex items-center gap-1 text-label font-medium text-brand transition-ui hover:underline"
                          >
                            Records
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}

              <tr className="border-t border-border font-semibold">
                <td className="py-2.5">Combined</td>
                <td className="py-2.5 text-right text-muted-foreground">—</td>
                {metric.isMoney && <td className="py-2.5" />}
                {metric.isMoney && (
                  <td className="py-2.5 text-right tabular-nums">
                    {combinedAvailable && moneyKey
                      ? formatMoney(combined.combined[moneyKey], currency)
                      : "unavailable"}
                  </td>
                )}
                {!metric.isMoney && (
                  <td className="py-2.5 text-right tabular-nums">
                    {combinedAvailable ? String(combined.combined.clientsClosed) : "—"}
                  </td>
                )}
                {showOpsLinks && <td className="py-2.5" />}
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {metric.isMoney && (
        <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">
            {combinedAvailable ? (
              <>
                Converted at the rate for{" "}
                <strong className="text-foreground">
                  {formatDate(combined.asOfDate)}
                </strong>{" "}
                — the end of the selected period, not today&rsquo;s rate, so the figure stays
                stable when you revisit it.{" "}
                {combined.rows.some((r) => r.converted.source === "MANUAL" && r.native.currency !== currency) && (
                  <Badge variant="brand" dot>
                    Manual rate applied
                  </Badge>
                )}
              </>
            ) : (
              <>
                No exchange rate is available for this period, so a combined total can&rsquo;t be
                shown. Each entity&rsquo;s own figure above is still exact.{" "}
                <Link href="/intelligence/fx" className="font-medium text-brand hover:underline">
                  Set a rate
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
