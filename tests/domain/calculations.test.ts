import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  calculateBalance,
  calculateCollectedFraction,
  calculateStatus,
  computeTransactionAggregate,
  sumPayments,
  wouldOverpay,
} from "@/domain/finance/calculations";

const D = (v: number | string) => new Prisma.Decimal(v);

describe("calculateStatus", () => {
  it("is PENDING when nothing has been paid", () => {
    expect(calculateStatus(D(10000), D(0))).toBe("PENDING");
  });

  it("is PARTIAL when some but not all has been paid", () => {
    expect(calculateStatus(D(10000), D(5000))).toBe("PARTIAL");
  });

  it("is PAID when the full amount has been paid", () => {
    expect(calculateStatus(D(10000), D(10000))).toBe("PAID");
  });

  it("is PAID when paid exceeds amount (defensive — should never happen given wouldOverpay guard)", () => {
    expect(calculateStatus(D(10000), D(10500))).toBe("PAID");
  });
});

describe("calculateBalance", () => {
  it("subtracts paid from amount due", () => {
    expect(calculateBalance(D(10000), D(3000)).toString()).toBe("7000");
  });

  it("never goes negative", () => {
    expect(calculateBalance(D(10000), D(12000)).toString()).toBe("0");
  });
});

describe("calculateCollectedFraction", () => {
  it("computes paid/amount", () => {
    expect(calculateCollectedFraction(D(30000), D(15000)).toString()).toBe("0.5");
  });

  it("returns 0 when amount is 0 (avoids divide-by-zero)", () => {
    expect(calculateCollectedFraction(D(0), D(0)).toString()).toBe("0");
  });
});

describe("sumPayments", () => {
  it("sums using Decimal arithmetic, not floating point", () => {
    // 0.1 + 0.2 famously != 0.3 in IEEE754 floats — Decimal must get this exact.
    expect(sumPayments([D("0.1"), D("0.2")]).toString()).toBe("0.3");
  });
});

describe("computeTransactionAggregate — the spec's worked example", () => {
  it("Amount Due 10,000 with payments 3,000 + 2,000 -> Paid 5,000, Balance 5,000, PARTIAL", () => {
    const result = computeTransactionAggregate(D(10000), [D(3000), D(2000)]);
    expect(result.paidAmount.toString()).toBe("5000");
    expect(result.balance.toString()).toBe("5000");
    expect(result.status).toBe("PARTIAL");
  });

  it("full payment in one shot -> PAID, zero balance", () => {
    const result = computeTransactionAggregate(D(27840), [D(27840)]);
    expect(result.status).toBe("PAID");
    expect(result.balance.toString()).toBe("0");
  });

  it("no payments yet -> PENDING, full balance", () => {
    const result = computeTransactionAggregate(D(5000), []);
    expect(result.status).toBe("PENDING");
    expect(result.balance.toString()).toBe("5000");
    expect(result.paidAmount.toString()).toBe("0");
  });
});

describe("wouldOverpay", () => {
  it("flags a payment that would push paid past the amount due", () => {
    expect(wouldOverpay(D(10000), D(8000), D(3000))).toBe(true);
  });

  it("allows a payment that lands exactly on the amount due", () => {
    expect(wouldOverpay(D(10000), D(8000), D(2000))).toBe(false);
  });

  it("allows a partial payment within the remaining balance", () => {
    expect(wouldOverpay(D(10000), D(3000), D(2000))).toBe(false);
  });
});
