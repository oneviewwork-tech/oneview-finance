import type { Prisma, Currency } from "@prisma/client";

export interface LiveRateResult {
  rate: Prisma.Decimal;
  asOf: Date;
  sourceDetail: string;
}

/**
 * Abstraction over "wherever live FX rates come from" — the spec requires
 * this be swappable without touching the rest of the app. `base` fetches
 * the full rate table so both directions of a pair can be derived from one
 * call (see refreshLiveRates).
 */
export interface ExchangeRateProvider {
  fetchRate(base: Currency, quote: Currency): Promise<LiveRateResult>;
}
