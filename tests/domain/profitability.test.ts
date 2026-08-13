import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  computeProfitability,
  lossMargin,
  profitMargin,
  daysToFirstPayment,
  summarisePaymentLag,
  SALARY_CATEGORY_NAMES,
} from "@/domain/finance/profitability";

const { Decimal } = Prisma;
const d = (v: string | number) => new Decimal(v);

describe("computeProfitability", () => {
  it("computes profit and margin on a normal month", () => {
    const p = computeProfitability(d("1585000"), d("1020000"));
    expect(p.profit.toString()).toBe("565000");
    // Asserted as the ratio itself rather than a hand-rounded literal, which
    // is how the first version of this test came to disagree with correct code.
    expect(p.margin.toNumber()).toBeCloseTo(565000 / 1585000, 9);
    expect(p.isLoss).toBe(false);
  });

  it("reports a loss when expenses exceed revenue", () => {
    const p = computeProfitability(d("100000"), d("150000"));
    expect(p.profit.toString()).toBe("-50000");
    expect(p.isLoss).toBe(true);
    expect(p.margin.toNumber()).toBeCloseTo(-0.5, 6);
  });

  // The first month of a new entity has costs and no receipts. Dividing by
  // zero would put "Infinity%" on the dashboard.
  it("returns a zero margin rather than dividing by zero revenue", () => {
    const p = computeProfitability(d("0"), d("40000"));
    expect(p.margin.toString()).toBe("0");
    expect(p.profit.toString()).toBe("-40000");
    expect(p.isLoss).toBe(true);
  });

  it("treats break-even as neither profit nor loss", () => {
    const p = computeProfitability(d("50000"), d("50000"));
    expect(p.profit.toString()).toBe("0");
    expect(p.isLoss).toBe(false);
    expect(p.margin.toString()).toBe("0");
  });

  it("uses Decimal arithmetic rather than floating point", () => {
    // 0.1 + 0.2 in float is 0.30000000000000004; this must be exact.
    const p = computeProfitability(d("0.3"), d("0.1"));
    expect(p.profit.toString()).toBe("0.2");
  });
});

describe("profitMargin / lossMargin", () => {
  it("shows the loss as a positive number and profit as zero", () => {
    const p = computeProfitability(d("100"), d("150"));
    expect(lossMargin(p).toNumber()).toBeCloseTo(0.5, 6);
    expect(profitMargin(p).toString()).toBe("0");
  });

  it("shows the profit and a zero loss when trading well", () => {
    const p = computeProfitability(d("200"), d("150"));
    expect(profitMargin(p).toNumber()).toBeCloseTo(0.25, 6);
    expect(lossMargin(p).toString()).toBe("0");
  });
});

describe("daysToFirstPayment", () => {
  it("counts whole days from the deal date", () => {
    expect(
      daysToFirstPayment({
        startedOn: new Date("2026-08-01T00:00:00Z"),
        firstPaidOn: new Date("2026-08-10T00:00:00Z"),
      })
    ).toBe(9);
  });

  it("treats same-day payment as zero days, not one", () => {
    expect(
      daysToFirstPayment({
        startedOn: new Date("2026-08-01T00:00:00Z"),
        firstPaidOn: new Date("2026-08-01T00:00:00Z"),
      })
    ).toBe(0);
  });

  it("returns null while nothing has been received", () => {
    expect(daysToFirstPayment({ startedOn: new Date("2026-08-01T00:00:00Z"), firstPaidOn: null })).toBeNull();
  });

  // A payment dated before its deal is a data-entry slip; letting it count
  // as negative days would quietly flatter the average.
  it("never returns negative days", () => {
    expect(
      daysToFirstPayment({
        startedOn: new Date("2026-08-10T00:00:00Z"),
        firstPaidOn: new Date("2026-08-01T00:00:00Z"),
      })
    ).toBe(0);
  });
});

describe("summarisePaymentLag", () => {
  const started = new Date("2026-08-01T00:00:00Z");
  const after = (days: number) => new Date(Date.UTC(2026, 7, 1 + days));

  it("averages only the deals that have actually been paid", () => {
    const s = summarisePaymentLag([
      { startedOn: started, firstPaidOn: after(0) },
      { startedOn: started, firstPaidOn: after(10) },
      { startedOn: started, firstPaidOn: after(20) },
      { startedOn: started, firstPaidOn: null },
    ]);
    expect(s.paidCount).toBe(3);
    expect(s.awaitingCount).toBe(1);
    expect(s.averageDays).toBe(10);
  });

  // The bug this guards: counting unpaid deals as zero days would make a
  // month of unpaid work look like everyone paid instantly.
  it("does not treat an unpaid deal as paid on day zero", () => {
    const allUnpaid = summarisePaymentLag([
      { startedOn: started, firstPaidOn: null },
      { startedOn: started, firstPaidOn: null },
    ]);
    expect(allUnpaid.averageDays).toBe(0);
    expect(allUnpaid.paidCount).toBe(0);
    expect(allUnpaid.awaitingCount).toBe(2);
  });

  it("reports a median that resists one very late payer", () => {
    const s = summarisePaymentLag([
      { startedOn: started, firstPaidOn: after(2) },
      { startedOn: started, firstPaidOn: after(3) },
      { startedOn: started, firstPaidOn: after(4) },
      { startedOn: started, firstPaidOn: after(200) },
    ]);
    expect(s.medianDays).toBe(3.5);
    expect(s.averageDays).toBe(52.3);
    expect(s.slowest).toBe(200);
    expect(s.fastest).toBe(2);
  });

  it("handles an empty set without dividing by zero", () => {
    const s = summarisePaymentLag([]);
    expect(s.averageDays).toBe(0);
    expect(s.medianDays).toBe(0);
    expect(s.paidCount).toBe(0);
  });
});

describe("SALARY_CATEGORY_NAMES", () => {
  // Narrow on purpose — commissions and freelancers are people-costs but not
  // salary, and including them would make the card disagree with finance.
  it("is payroll only", () => {
    expect([...SALARY_CATEGORY_NAMES]).toEqual(["Salaries & Allowances"]);
  });
});
