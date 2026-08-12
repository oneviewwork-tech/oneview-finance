import { Prisma } from "@prisma/client";
import type { Currency, RateSource } from "@prisma/client";
import type { DateRange } from "@/domain/finance/date-range";
import { getEntitySummary, type EntitySummaryRow } from "./summary";
import { getRateForDate } from "@/services/fx/exchange-rate.service";

const { Decimal } = Prisma;

export interface ConvertedFigures {
  available: boolean;
  totalInflow: Prisma.Decimal;
  totalOutflowDue: Prisma.Decimal;
  outflowPaid: Prisma.Decimal;
  outflowPending: Prisma.Decimal;
  receivables: Prisma.Decimal;
  netPosition: Prisma.Decimal;
  rate?: Prisma.Decimal;
  rateDate?: Date;
  source?: RateSource;
}

export interface CombinedEntityRow {
  native: EntitySummaryRow;
  converted: ConvertedFigures;
}

export interface CombinedSummaryResult {
  reportingCurrency: Currency;
  asOfDate: Date;
  rows: CombinedEntityRow[];
  /** Sums across entities — only trustworthy (and only computed) when every entity converted successfully. */
  combined: (ConvertedFigures & { clientsClosed: number }) | { available: false };
}

const MONEY_FIELDS = ["totalInflow", "totalOutflowDue", "outflowPaid", "outflowPending", "receivables"] as const;

/**
 * The spec's core combined-dashboard rule: never just add AED + INR. Every
 * entity's figures are converted into `reportingCurrency` using the rate as
 * of `range.to` (the period's own rate, not necessarily "today"), and only
 * summed once every entity has converted successfully — a missing rate for
 * even one entity means the combined total is explicitly flagged
 * unavailable rather than silently treating that entity as zero.
 */
export async function getCombinedSummary(reportingCurrency: Currency, range: DateRange): Promise<CombinedSummaryResult> {
  const asOfDate = range.to;
  const entityRows = await getEntitySummary(range);

  const rows: CombinedEntityRow[] = await Promise.all(
    entityRows.map(async (native) => {
      const nativeCurrency = native.currency as Currency;

      if (nativeCurrency === reportingCurrency) {
        return {
          native,
          converted: {
            available: true,
            totalInflow: native.totalInflow,
            totalOutflowDue: native.totalOutflowDue,
            outflowPaid: native.outflowPaid,
            outflowPending: native.outflowPending,
            receivables: native.receivables,
            netPosition: native.netPosition,
            rate: new Decimal(1),
            rateDate: asOfDate,
            source: "MANUAL" as RateSource,
          },
        };
      }

      // One rate lookup covers all 5 money fields — MONEY_FIELDS previously
      // called convertAmount() (and therefore re-queried the same rate) once
      // per field, firing 5 identical DB round trips for a single entity.
      const resolved = await getRateForDate(nativeCurrency, reportingCurrency, asOfDate);

      if (!resolved) {
        return {
          native,
          converted: {
            available: false,
            totalInflow: new Decimal(0),
            totalOutflowDue: new Decimal(0),
            outflowPaid: new Decimal(0),
            outflowPending: new Decimal(0),
            receivables: new Decimal(0),
            netPosition: new Decimal(0),
          },
        };
      }

      const [totalInflow, totalOutflowDue, outflowPaid, outflowPending, receivables] = MONEY_FIELDS.map((field) =>
        native[field].mul(resolved.rate)
      );

      return {
        native,
        converted: {
          available: true,
          totalInflow,
          totalOutflowDue,
          outflowPaid,
          outflowPending,
          receivables,
          netPosition: totalInflow.minus(outflowPaid),
          rate: resolved.rate,
          rateDate: resolved.rateDate,
          source: resolved.source,
        },
      };
    })
  );

  const allConverted = rows.every((r) => r.converted.available);
  if (!allConverted) {
    return { reportingCurrency, asOfDate, rows, combined: { available: false } };
  }

  const combined = rows.reduce(
    (acc, r) => ({
      available: true as const,
      totalInflow: acc.totalInflow.plus(r.converted.totalInflow),
      totalOutflowDue: acc.totalOutflowDue.plus(r.converted.totalOutflowDue),
      outflowPaid: acc.outflowPaid.plus(r.converted.outflowPaid),
      outflowPending: acc.outflowPending.plus(r.converted.outflowPending),
      receivables: acc.receivables.plus(r.converted.receivables),
      netPosition: acc.netPosition.plus(r.converted.netPosition),
      clientsClosed: acc.clientsClosed + r.native.clientsClosed,
    }),
    {
      available: true as const,
      totalInflow: new Decimal(0),
      totalOutflowDue: new Decimal(0),
      outflowPaid: new Decimal(0),
      outflowPending: new Decimal(0),
      receivables: new Decimal(0),
      netPosition: new Decimal(0),
      clientsClosed: 0,
    }
  );

  return { reportingCurrency, asOfDate, rows, combined };
}

export interface FxBannerContext {
  available: boolean;
  aedToInrRate?: Prisma.Decimal;
  rateDate?: Date;
  source?: RateSource;
}

/** "1 AED = ₹X · Updated: <date>" context for the currency selector banner — the spec insists this is never hidden when a combined/converted view is shown. */
export async function getFxBannerContext(asOfDate: Date): Promise<FxBannerContext> {
  const resolved = await getRateForDate("AED", "INR", asOfDate);
  if (!resolved) return { available: false };
  return { available: true, aedToInrRate: resolved.rate, rateDate: resolved.rateDate, source: resolved.source };
}
