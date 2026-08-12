import { afterEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  convertAmount,
  getRateForDate,
  refreshLiveRates,
  setManualRate,
} from "@/services/fx/exchange-rate.service";
import type { ExchangeRateProvider, LiveRateResult } from "@/services/fx/provider";

const { Decimal } = Prisma;
const D = (v: number | string) => new Decimal(v);

class FakeProvider implements ExchangeRateProvider {
  constructor(private readonly result: LiveRateResult) {}
  async fetchRate(): Promise<LiveRateResult> {
    return this.result;
  }
}

afterEach(async () => {
  await prisma.exchangeRate.deleteMany({ where: { sourceDetail: { contains: "_TEST" } } });
});

describe("getRateForDate", () => {
  it("returns rate 1 for same-currency conversion without touching the DB", async () => {
    const result = await getRateForDate("AED", "AED", new Date());
    expect(result?.rate.toString()).toBe("1");
  });

  it("returns null (never a guess) when no rate exists at all", async () => {
    const result = await getRateForDate("AED", "INR", new Date(Date.UTC(1999, 0, 1)));
    expect(result).toBeNull();
  });

  it("falls back to the most recent rate on or before the requested date", async () => {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } });
    await prisma.exchangeRate.create({
      data: {
        baseCurrency: "AED",
        quoteCurrency: "INR",
        rate: "23.5",
        rateDate: new Date(Date.UTC(2026, 6, 1)),
        source: "LIVE",
        sourceDetail: "_TEST fallback",
      },
    });
    const result = await getRateForDate("AED", "INR", new Date(Date.UTC(2026, 6, 15)));
    expect(result?.rate.toString()).toBe("23.5");
    expect(result?.source).toBe("LIVE");
    void admin;
  });

  it("a MANUAL override on the same date wins over a LIVE rate from that date", async () => {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } });
    const rateDate = new Date(Date.UTC(2026, 6, 20));
    await prisma.exchangeRate.createMany({
      data: [
        { baseCurrency: "AED", quoteCurrency: "INR", rate: "23.4", rateDate, source: "LIVE", sourceDetail: "_TEST live" },
        {
          baseCurrency: "AED",
          quoteCurrency: "INR",
          rate: "23.6",
          rateDate,
          source: "MANUAL",
          sourceDetail: "_TEST manual override",
          createdById: admin.id,
        },
      ],
    });
    const result = await getRateForDate("AED", "INR", rateDate);
    expect(result?.rate.toString()).toBe("23.6");
    expect(result?.source).toBe("MANUAL");
  });
});

describe("convertAmount", () => {
  it("passes through unchanged for same-currency", async () => {
    const result = await convertAmount(D(1000), "AED", "AED", new Date());
    expect(result.available).toBe(true);
    if (result.available) expect(result.convertedAmount.toString()).toBe("1000");
  });

  it("converts using the resolved rate", async () => {
    const rateDate = new Date(Date.UTC(2026, 6, 25));
    await prisma.exchangeRate.create({
      data: {
        baseCurrency: "AED",
        quoteCurrency: "INR",
        rate: "23",
        rateDate,
        source: "LIVE",
        sourceDetail: "_TEST convert",
      },
    });
    const result = await convertAmount(D(1000), "AED", "INR", rateDate);
    expect(result.available).toBe(true);
    if (result.available) expect(result.convertedAmount.toString()).toBe("23000");
  });

  it("reports unavailable rather than guessing when no rate exists", async () => {
    const result = await convertAmount(D(1000), "AED", "INR", new Date(Date.UTC(1999, 0, 1)));
    expect(result.available).toBe(false);
  });
});

describe("refreshLiveRates", () => {
  it("stores both directions as perfectly inverse from a single provider call", async () => {
    const provider = new FakeProvider({ rate: D("23.4"), asOf: new Date(), sourceDetail: "_TEST fake provider" });
    await refreshLiveRates(provider);

    const today = new Date();
    const aedToInr = await getRateForDate("AED", "INR", today);
    const inrToAed = await getRateForDate("INR", "AED", today);

    expect(aedToInr?.rate.toString()).toBe("23.4");
    // ExchangeRate.rate is Decimal(14,6) — the derived inverse is rounded to
    // that column precision on write, so compare at 6 decimal places, not full float precision.
    expect(Number(inrToAed?.rate.toString())).toBeCloseTo(1 / 23.4, 6);
  });
});

describe("setManualRate", () => {
  it("stores a MANUAL rate and writes an FX_RATE_UPDATED audit event", async () => {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } });
    const rateDate = new Date(Date.UTC(2026, 6, 30));

    await setManualRate({
      baseCurrency: "AED",
      quoteCurrency: "INR",
      rate: D("23.75"),
      rateDate,
      actorId: admin.id,
      actorEmail: admin.email,
    });

    const stored = await prisma.exchangeRate.findFirst({
      where: { baseCurrency: "AED", quoteCurrency: "INR", rateDate, source: "MANUAL" },
    });
    expect(stored?.rate.toString()).toBe("23.75");

    const audit = await prisma.auditEvent.findFirst({
      where: { entityType: "ExchangeRate", entityId: stored!.id, action: "FX_RATE_UPDATED" },
    });
    expect(audit).not.toBeNull();

    await prisma.auditEvent.deleteMany({ where: { entityId: stored!.id } });
    await prisma.exchangeRate.delete({ where: { id: stored!.id } });
  });
});
