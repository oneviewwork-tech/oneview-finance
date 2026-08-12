import { Prisma } from "@prisma/client";

const { Decimal } = Prisma;

export interface PeriodChange {
  absoluteChange: Prisma.Decimal;
  /** null when the previous value was 0 — the spec explicitly forbids a misleading %. */
  percentChange: Prisma.Decimal | null;
}

export function calculatePeriodChange(current: Prisma.Decimal, previous: Prisma.Decimal): PeriodChange {
  const absoluteChange = current.minus(previous);
  if (previous.eq(0)) {
    return { absoluteChange, percentChange: null };
  }
  return { absoluteChange, percentChange: absoluteChange.div(previous) };
}

export const ZERO = new Decimal(0);
