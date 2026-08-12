import { Prisma } from "@prisma/client";
import type { Currency } from "@prisma/client";
import type { ExchangeRateProvider, LiveRateResult } from "./provider";

const { Decimal } = Prisma;

interface OpenErApiResponse {
  result: string;
  rates: Record<string, number>;
  time_last_update_utc: string;
}

/**
 * Free, no-API-key-required provider (https://www.exchangerate-api.com/docs/free),
 * updated ~daily. Chosen for Phase 4 so "live FX from day one" doesn't force
 * the user to configure a provider key before the dashboard works at all —
 * FX_PROVIDER_API_KEY stays reserved in .env for swapping in a keyed
 * provider later without touching call sites.
 */
export class OpenErApiProvider implements ExchangeRateProvider {
  async fetchRate(base: Currency, quote: Currency): Promise<LiveRateResult> {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    if (!res.ok) {
      throw new Error(`FX provider request failed: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as OpenErApiResponse;
    if (data.result !== "success") {
      throw new Error("FX provider returned a non-success result");
    }
    const rate = data.rates[quote];
    if (rate === undefined) {
      throw new Error(`FX provider has no rate for ${base}->${quote}`);
    }
    return {
      rate: new Decimal(rate),
      asOf: new Date(data.time_last_update_utc),
      sourceDetail: "open.er-api.com",
    };
  }
}
