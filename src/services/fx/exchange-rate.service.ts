import { Prisma } from "@prisma/client";
import type { Currency, RateSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import { OpenErApiProvider } from "./open-er-api-provider";
import type { ExchangeRateProvider } from "./provider";

const { Decimal } = Prisma;

const defaultProvider: ExchangeRateProvider = new OpenErApiProvider();

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export interface ResolvedRate {
  rate: Prisma.Decimal;
  rateDate: Date;
  source: RateSource;
  sourceDetail: string | null;
}

/**
 * Resolves the rate to use for a given date — never "today's live rate"
 * blindly. Prefers a MANUAL override dated exactly on/before `date` over a
 * LIVE rate from the same date (a Finance Admin's explicit correction wins),
 * otherwise falls back to the most recent available rate on or before that
 * date. Returns null — never a guess — if no rate exists at all yet.
 */
export async function getRateForDate(base: Currency, quote: Currency, date: Date): Promise<ResolvedRate | null> {
  if (base === quote) {
    return { rate: new Decimal(1), rateDate: date, source: "MANUAL", sourceDetail: "same currency" };
  }

  const candidates = await prisma.exchangeRate.findMany({
    where: { baseCurrency: base, quoteCurrency: quote, rateDate: { lte: date } },
    orderBy: { rateDate: "desc" },
    take: 10,
  });
  if (candidates.length === 0) return null;

  const latestDate = candidates[0].rateDate.getTime();
  const sameDate = candidates.filter((c) => c.rateDate.getTime() === latestDate);
  const chosen = sameDate.find((c) => c.source === "MANUAL") ?? sameDate[0];

  return { rate: chosen.rate, rateDate: chosen.rateDate, source: chosen.source, sourceDetail: chosen.sourceDetail };
}

export type ConversionResult =
  | { available: true; convertedAmount: Prisma.Decimal; rate: Prisma.Decimal; rateDate: Date; source: RateSource }
  | { available: false };

export async function convertAmount(
  amount: Prisma.Decimal,
  from: Currency,
  to: Currency,
  date: Date
): Promise<ConversionResult> {
  if (from === to) {
    return { available: true, convertedAmount: amount, rate: new Decimal(1), rateDate: date, source: "MANUAL" };
  }
  const resolved = await getRateForDate(from, to, date);
  if (!resolved) return { available: false };
  return {
    available: true,
    convertedAmount: amount.mul(resolved.rate),
    rate: resolved.rate,
    rateDate: resolved.rateDate,
    source: resolved.source,
  };
}

/** Fetches AED->INR from the live provider and derives INR->AED from it, so both directions stay perfectly inverse-consistent from a single call. */
export async function refreshLiveRates(provider: ExchangeRateProvider = defaultProvider): Promise<void> {
  const { rate, asOf, sourceDetail } = await provider.fetchRate("AED", "INR");
  const rateDate = startOfUtcDay(asOf);
  const inverseRate = new Decimal(1).div(rate);

  await prisma.$transaction([
    prisma.exchangeRate.upsert({
      where: {
        baseCurrency_quoteCurrency_rateDate_source: {
          baseCurrency: "AED",
          quoteCurrency: "INR",
          rateDate,
          source: "LIVE",
        },
      },
      update: { rate, sourceDetail },
      create: { baseCurrency: "AED", quoteCurrency: "INR", rateDate, rate, source: "LIVE", sourceDetail },
    }),
    prisma.exchangeRate.upsert({
      where: {
        baseCurrency_quoteCurrency_rateDate_source: {
          baseCurrency: "INR",
          quoteCurrency: "AED",
          rateDate,
          source: "LIVE",
        },
      },
      update: { rate: inverseRate, sourceDetail },
      create: { baseCurrency: "INR", quoteCurrency: "AED", rateDate, rate: inverseRate, source: "LIVE", sourceDetail },
    }),
  ]);
}

/**
 * Lazy on-demand fetch: if today's live rate hasn't been captured yet, get
 * it now. Called from the dashboard's data-loading path so "live from day
 * one" doesn't require standing up a cron job. Never throws into the page —
 * if the provider is unreachable, the dashboard falls back to whatever rate
 * (if any) already exists and shows "Exchange rate unavailable" rather than
 * crashing or fabricating a number.
 */
export async function ensureTodayLiveRate(): Promise<void> {
  const today = startOfUtcDay(new Date());
  const existing = await prisma.exchangeRate.findFirst({
    where: { baseCurrency: "AED", quoteCurrency: "INR", rateDate: today },
  });
  if (existing) return;
  try {
    await refreshLiveRates();
  } catch (err) {
    console.error("FX live refresh failed:", err);
  }
}

export async function setManualRate(input: {
  baseCurrency: Currency;
  quoteCurrency: Currency;
  rate: Prisma.Decimal;
  rateDate: Date;
  actorId: string;
  actorEmail: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const record = await tx.exchangeRate.upsert({
      where: {
        baseCurrency_quoteCurrency_rateDate_source: {
          baseCurrency: input.baseCurrency,
          quoteCurrency: input.quoteCurrency,
          rateDate: input.rateDate,
          source: "MANUAL",
        },
      },
      update: { rate: input.rate, createdById: input.actorId },
      create: {
        baseCurrency: input.baseCurrency,
        quoteCurrency: input.quoteCurrency,
        rateDate: input.rateDate,
        rate: input.rate,
        source: "MANUAL",
        createdById: input.actorId,
      },
    });
    await writeAuditEvent(tx, {
      entityType: "ExchangeRate",
      entityId: record.id,
      action: "FX_RATE_UPDATED",
      actorUserId: input.actorId,
      actorEmail: input.actorEmail,
      after: { ...record, rate: record.rate.toString() },
    });
  });
}
