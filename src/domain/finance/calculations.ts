import { Prisma } from "@prisma/client";

const { Decimal } = Prisma;
export type Money = Prisma.Decimal;

export type TransactionStatus = "PENDING" | "PARTIAL" | "PAID";

/**
 * Mirrors the workbook's Status formula exactly:
 * IF(paid<=0,"PENDING",IF(paid>=amount,"PAID","PARTIAL"))
 */
export function calculateStatus(amount: Money, paid: Money): TransactionStatus {
  if (paid.lte(0)) return "PENDING";
  if (paid.gte(amount)) return "PAID";
  return "PARTIAL";
}

/** Balance (AED)/Balance Due — amount - paid. Never returned negative; callers must not let paid exceed amount. */
export function calculateBalance(amount: Money, paid: Money): Money {
  const balance = amount.minus(paid);
  return balance.lt(0) ? new Decimal(0) : balance;
}

/**
 * % Collected / % Settled — IF(amount=0,0,paid/amount). Returned as a
 * Decimal fraction (0..1); UI multiplies by 100 for display.
 */
export function calculateCollectedFraction(amount: Money, paid: Money): Money {
  if (amount.eq(0)) return new Decimal(0);
  return paid.div(amount);
}

/** Sums a list of payment amounts using Decimal arithmetic (never floating point). */
export function sumPayments(amounts: Money[]): Money {
  return amounts.reduce((total, amt) => total.plus(amt), new Decimal(0));
}

export interface TransactionAggregate {
  paidAmount: Money;
  balance: Money;
  status: TransactionStatus;
  collectedFraction: Money;
}

/** Recomputes everything derived from a transaction's original amount + its payment ledger. */
export function computeTransactionAggregate(
  originalAmount: Money,
  paymentAmounts: Money[]
): TransactionAggregate {
  const paidAmount = sumPayments(paymentAmounts);
  return {
    paidAmount,
    balance: calculateBalance(originalAmount, paidAmount),
    status: calculateStatus(originalAmount, paidAmount),
    collectedFraction: calculateCollectedFraction(originalAmount, paidAmount),
  };
}

/**
 * Guards the "no overpayment" business rule: the workbook never allows Paid
 * > Amount Due, and the spec says not to allow it unless a transaction type
 * explicitly supports refunds/reversals (which this app doesn't yet).
 */
export function wouldOverpay(originalAmount: Money, existingPaid: Money, newPaymentAmount: Money): boolean {
  return existingPaid.plus(newPaymentAmount).gt(originalAmount);
}
