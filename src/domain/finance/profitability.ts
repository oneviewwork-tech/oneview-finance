import { Prisma } from "@prisma/client";

const { Decimal } = Prisma;

type Money = Prisma.Decimal;

/**
 * Profit, loss and how promptly clients pay.
 *
 * Pure and Decimal-based — these are the figures leadership reads off the
 * dashboard, and a rounding shortcut here would be visible in the numbers
 * people make decisions on.
 */

/**
 * Which expense categories are payroll.
 *
 * Deliberately narrow: commissions, freelancers and payroll bank charges are
 * real people-costs but not salary, and rolling them in would make the card
 * disagree with what finance means by the word. Matched by name because the
 * categories are user-editable master data with no stable code.
 */
export const SALARY_CATEGORY_NAMES = ["Salaries & Allowances"] as const;

export interface Profitability {
  /** Revenue actually received, net of tax. */
  revenue: Money;
  /** Expenses actually paid out. */
  expenses: Money;
  /** revenue - expenses. Negative means a loss. */
  profit: Money;
  /**
   * profit / revenue, as a fraction. Zero when there is no revenue: a
   * percentage of nothing is not infinity, and rendering it as one would
   * put "Infinity%" on the dashboard the first time a month opened with
   * costs but no receipts.
   */
  margin: Money;
  /** True when expenses exceeded revenue. */
  isLoss: boolean;
}

/**
 * Cash basis, matching the Net Position tile: money in against money out.
 * An accrual figure would be defensible too, but two different "profit"
 * numbers on one screen is how people stop trusting a dashboard.
 */
export function computeProfitability(revenue: Money, expenses: Money): Profitability {
  const profit = revenue.minus(expenses);
  return {
    revenue,
    expenses,
    profit,
    margin: revenue.eq(0) ? new Decimal(0) : profit.div(revenue),
    isLoss: profit.lt(0),
  };
}

/**
 * The loss margin as a positive number, for display on a "Loss %" card.
 * Zero when trading at a profit, so the card reads as 0% rather than as a
 * negative loss, which nobody parses correctly at a glance.
 */
export function lossMargin(p: Profitability): Money {
  return p.isLoss ? p.margin.abs() : new Decimal(0);
}

/** Profit margin clamped to zero when making a loss, mirroring lossMargin. */
export function profitMargin(p: Profitability): Money {
  return p.isLoss ? new Decimal(0) : p.margin;
}

// ── How long clients take to pay ────────────────────────────────────────

export interface PaymentLagInput {
  /** When the work was booked — the invoice/deal date. */
  startedOn: Date;
  /** When money first arrived. Null while nothing has been received. */
  firstPaidOn: Date | null;
}

/**
 * Whole days from the deal date to the first receipt.
 *
 * Same-day payment is 0, not 1. Never negative: a payment recorded before
 * its own deal date is a data-entry slip, and letting it pull the average
 * down would quietly flatter the figure.
 */
export function daysToFirstPayment(input: PaymentLagInput): number | null {
  if (!input.firstPaidOn) return null;
  const ms = input.firstPaidOn.getTime() - input.startedOn.getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

export interface PaymentLagSummary {
  /** Mean days to first payment across deals that have been paid at all. */
  averageDays: number;
  /** Middle value — resistant to one very late payer skewing the mean. */
  medianDays: number;
  /** Deals with at least one receipt. */
  paidCount: number;
  /** Deals still awaiting a first receipt; excluded from the averages. */
  awaitingCount: number;
  slowest: number;
  fastest: number;
}

/**
 * Summarises payment lag across a set of deals.
 *
 * Unpaid deals are counted but excluded from the averages: they have no lag
 * yet, and treating "not paid" as zero days would make a month of unpaid
 * work look like instant payment — precisely backwards.
 */
export function summarisePaymentLag(inputs: PaymentLagInput[]): PaymentLagSummary {
  const days: number[] = [];
  let awaitingCount = 0;

  for (const input of inputs) {
    const d = daysToFirstPayment(input);
    if (d === null) awaitingCount += 1;
    else days.push(d);
  }

  if (days.length === 0) {
    return { averageDays: 0, medianDays: 0, paidCount: 0, awaitingCount, slowest: 0, fastest: 0 };
  }

  days.sort((a, b) => a - b);
  const total = days.reduce((sum, d) => sum + d, 0);
  const mid = Math.floor(days.length / 2);

  return {
    averageDays: Math.round((total / days.length) * 10) / 10,
    medianDays: days.length % 2 === 0 ? (days[mid - 1] + days[mid]) / 2 : days[mid],
    paidCount: days.length,
    awaitingCount,
    slowest: days[days.length - 1],
    fastest: days[0],
  };
}
