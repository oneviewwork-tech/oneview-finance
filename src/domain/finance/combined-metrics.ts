/**
 * The metrics a Combined tile can drill into.
 *
 * A registry rather than a switch at each call site: the tile, the breakdown
 * page heading, and the column it reads all have to agree, and three
 * independent lookups drift. Keyed by the URL value so a bad `?metric=`
 * fails one obvious way.
 */

/**
 * Money metrics exist on both the native figures and the converted ones, so
 * they can be indexed on either. Split out as its own type so the breakdown
 * page can narrow to it rather than casting — `clientsClosed` is a count and
 * genuinely absent from the converted shape.
 */
export type MoneyMetricKey =
  | "totalInflow"
  | "totalOutflowDue"
  | "outflowPaid"
  | "outflowPending"
  | "receivables"
  | "netPosition";

export type CombinedMetricKey = MoneyMetricKey | "clientsClosed";

export interface CombinedMetricSpec {
  key: CombinedMetricKey;
  label: string;
  description: string;
  /** Narrowing helper — lets callers index the converted figures safely. */
  /**
   * Counts aren't money: they're never FX-converted, and showing a
   * "converted" column for them would be nonsense.
   */
  isMoney: boolean;
  /** Where an entity's underlying records live, if there is such a list. */
  recordsPath?: (slug: string) => string;
}

export const COMBINED_METRICS: Record<CombinedMetricKey, CombinedMetricSpec> = {
  totalInflow: {
    key: "totalInflow",
    label: "Total Inflow Received",
    description: "Payments actually received from clients, by entity.",
    isMoney: true,
    recordsPath: (slug) => `/operations/${slug}/inflow/all`,
  },
  totalOutflowDue: {
    key: "totalOutflowDue",
    label: "Total Outflow Due",
    description: "Everything owed on recorded expenses, by entity.",
    isMoney: true,
    recordsPath: (slug) => `/operations/${slug}/outflow/all`,
  },
  outflowPaid: {
    key: "outflowPaid",
    label: "Outflow Paid",
    description: "Expenses already settled, by entity.",
    isMoney: true,
    recordsPath: (slug) => `/operations/${slug}/outflow/all?status=PAID`,
  },
  outflowPending: {
    key: "outflowPending",
    label: "Outflow Pending",
    description: "Expenses still owed — liabilities, by entity.",
    isMoney: true,
    recordsPath: (slug) => `/operations/${slug}/outflow/all?status=unpaid`,
  },
  receivables: {
    key: "receivables",
    label: "Receivables",
    description: "Still owed by clients, by entity.",
    isMoney: true,
    recordsPath: (slug) => `/operations/${slug}/inflow/all?status=unpaid`,
  },
  netPosition: {
    key: "netPosition",
    label: "Net Position",
    description: "Inflow received minus outflow paid, by entity.",
    isMoney: true,
  },
  clientsClosed: {
    key: "clientsClosed",
    label: "Clients Closed",
    description: "Deals recorded in the period, by entity.",
    isMoney: false,
    recordsPath: (slug) => `/operations/${slug}/inflow/all`,
  },
};

/** True when the metric can be read off both native and converted figures. */
export function isMoneyMetric(spec: CombinedMetricSpec): spec is CombinedMetricSpec & { key: MoneyMetricKey } {
  return spec.isMoney;
}

export function parseCombinedMetric(value: string | undefined | null): CombinedMetricSpec | null {
  if (!value) return null;
  // Object.hasOwn, not plain indexing: `?metric=toString` would otherwise
  // resolve to Object.prototype.toString — a Function, not a spec — and blow
  // up downstream instead of being rejected as the bad input it is.
  if (!Object.hasOwn(COMBINED_METRICS, value)) return null;
  return COMBINED_METRICS[value as CombinedMetricKey];
}
