/**
 * The Finance View cards that drill into a detail page of their own.
 *
 * A registry rather than a switch per call site: the card, the page heading
 * and the query it runs all have to agree, and three independent lookups
 * drift. Keyed by the URL value so a bad ?insight= fails one obvious way.
 */

export type InsightKey = "salary" | "profit" | "loss" | "paymentSpeed";

export interface InsightSpec {
  key: InsightKey;
  label: string;
  description: string;
  /** Shown under the headline figure on the detail page. */
  detailTitle: string;
}

export const INSIGHTS: Record<InsightKey, InsightSpec> = {
  salary: {
    key: "salary",
    label: "Salary",
    description: "Payroll paid",
    detailTitle: "Where payroll went, by department",
  },
  profit: {
    key: "profit",
    label: "Profit %",
    description: "Revenue received less expenses paid, as a share of revenue,",
    detailTitle: "What made up the profit",
  },
  loss: {
    key: "loss",
    label: "Loss %",
    description: "How far expenses paid exceeded revenue received,",
    detailTitle: "What drove the loss",
  },
  paymentSpeed: {
    key: "paymentSpeed",
    label: "Client Payment Speed",
    description: "Average days from a deal being booked to the first payment arriving,",
    detailTitle: "How long each client took to pay",
  },
};

export function parseInsight(value: string | undefined | null): InsightSpec | null {
  if (!value) return null;
  // Object.hasOwn, not plain indexing: ?insight=toString would otherwise
  // resolve to Object.prototype.toString and blow up downstream instead of
  // being rejected as the bad input it is.
  if (!Object.hasOwn(INSIGHTS, value)) return null;
  return INSIGHTS[value as InsightKey];
}
