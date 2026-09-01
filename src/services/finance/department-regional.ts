import { Prisma } from "@prisma/client";
import type { Currency } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DateRange } from "@/domain/finance/date-range";
import { SALARY_CATEGORY_NAMES } from "@/domain/finance/profitability";
import { getRateForDate } from "@/services/fx/exchange-rate.service";

const { Decimal } = Prisma;

/**
 * One department's figures, region by region.
 *
 * A department is global — Social Media sells in both Dubai and Bangalore —
 * so "is this team worth running" only makes sense with both regions on the
 * table together. They keep their books in different currencies, which is
 * why the Total column is an FX conversion and not a sum.
 */

/** The money fields a region row and its Total column share. */
export type DepartmentMoneyKey =
  | "revenue"
  | "received"
  | "outstanding"
  | "salary"
  | "otherExpenses"
  | "spent"
  | "net";

export type DepartmentMoney = Record<DepartmentMoneyKey, Prisma.Decimal>;

export interface DepartmentRegionFigures extends DepartmentMoney {
  entityId: string;
  entityCode: string;
  entityName: string;
  currency: Currency;
  inflowCount: number;
  outflowCount: number;
}

export type DepartmentTotal =
  | (DepartmentMoney & { available: true; inflowCount: number; outflowCount: number })
  | { available: false };

export interface DepartmentRegionalResult {
  departmentId: string;
  departmentName: string;
  reportingCurrency: Currency;
  regions: DepartmentRegionFigures[];
  /** Converted and summed. Unavailable if any region's rate is missing. */
  total: DepartmentTotal;
  /** Rate used per entity, for the "how was this converted" line. */
  rates: { entityCode: string; rate: Prisma.Decimal | null }[];
}

async function figuresForEntity(
  entity: { id: string; code: string; name: string; baseCurrency: Currency },
  departmentId: string,
  range?: DateRange
): Promise<DepartmentRegionFigures> {
  const dateFilter = range ? { gte: range.from, lte: range.to } : undefined;
  const base = { entityId: entity.id, departmentId, transactionDate: dateFilter };

  const [inflow, salaryAgg, outflowAgg] = await Promise.all([
    prisma.financialTransaction.aggregate({
      where: { ...base, transactionType: "INFLOW" },
      _sum: { originalAmount: true, paidAmount: true, taxAmount: true },
      _count: true,
    }),
    prisma.financialTransaction.aggregate({
      where: {
        ...base,
        transactionType: "OUTFLOW",
        category: { name: { in: [...SALARY_CATEGORY_NAMES] } },
      },
      _sum: { originalAmount: true },
    }),
    prisma.financialTransaction.aggregate({
      where: { ...base, transactionType: "OUTFLOW" },
      _sum: { originalAmount: true },
      _count: true,
    }),
  ]);

  const gross = inflow._sum.originalAmount ?? new Decimal(0);
  const grossReceived = inflow._sum.paidAmount ?? new Decimal(0);
  const tax = inflow._sum.taxAmount ?? new Decimal(0);

  // Tax is collected in step with payments, so the received figure is netted
  // by the same proportion of the invoice that has actually been paid — the
  // rule the inflow summary already uses, kept identical rather than
  // approximated into a second, drifting one.
  const collectedTax = gross.eq(0) ? new Decimal(0) : tax.mul(grossReceived).div(gross);

  const revenue = gross.minus(tax);
  const received = grossReceived.minus(collectedTax);
  const salary = salaryAgg._sum.originalAmount ?? new Decimal(0);
  const spent = outflowAgg._sum.originalAmount ?? new Decimal(0);

  return {
    entityId: entity.id,
    entityCode: entity.code,
    entityName: entity.name,
    currency: entity.baseCurrency,
    revenue,
    received,
    // Gross: the client owes the tax too, so netting it would understate
    // what is actually still to be collected.
    outstanding: gross.minus(grossReceived),
    salary,
    otherExpenses: spent.minus(salary),
    spent,
    net: revenue.minus(spent),
    inflowCount: inflow._count,
    outflowCount: outflowAgg._count,
  };
}

const ZERO_MONEY: DepartmentMoney = {
  revenue: new Decimal(0),
  received: new Decimal(0),
  outstanding: new Decimal(0),
  salary: new Decimal(0),
  otherExpenses: new Decimal(0),
  spent: new Decimal(0),
  net: new Decimal(0),
};

const MONEY_KEYS: DepartmentMoneyKey[] = [
  "revenue",
  "received",
  "outstanding",
  "salary",
  "otherExpenses",
  "spent",
  "net",
];

/** Resolves each entity's rate into `reportingCurrency` once — shared by a
 *  single department's lookup and by the all-departments card list, which
 *  would otherwise re-resolve the identical conversion once per department. */
async function resolveRates(
  entities: { code: string; baseCurrency: Currency }[],
  reportingCurrency: Currency,
  asOf: Date
): Promise<{ entityCode: string; rate: Prisma.Decimal | null }[]> {
  return Promise.all(
    entities.map(async (e) => {
      if (e.baseCurrency === reportingCurrency) return { entityCode: e.code, rate: new Decimal(1) };
      const resolved = await getRateForDate(e.baseCurrency, reportingCurrency, asOf);
      return { entityCode: e.code, rate: resolved?.rate ?? null };
    })
  );
}

/** One missing rate makes the Total wrong rather than approximate, so it is
 *  withheld rather than silently treating that region as zero. */
function combineRegions(
  regions: DepartmentRegionFigures[],
  rates: { entityCode: string; rate: Prisma.Decimal | null }[]
): DepartmentTotal {
  if (rates.some((r) => r.rate === null)) return { available: false };

  const summed: DepartmentMoney = { ...ZERO_MONEY };
  let inflowCount = 0;
  let outflowCount = 0;
  regions.forEach((r, i) => {
    const rate = rates[i].rate!;
    for (const key of MONEY_KEYS) summed[key] = summed[key].plus(r[key].mul(rate));
    inflowCount += r.inflowCount;
    outflowCount += r.outflowCount;
  });
  return { available: true, ...summed, inflowCount, outflowCount };
}

export async function getDepartmentRegional(
  departmentId: string,
  reportingCurrency: Currency,
  range?: DateRange
): Promise<DepartmentRegionalResult | null> {
  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) return null;

  const entities = await prisma.businessEntity.findMany({
    where: { status: "ACTIVE" },
    orderBy: { code: "asc" },
  });

  const regions = await Promise.all(entities.map((e) => figuresForEntity(e, departmentId, range)));

  // The period's own rate, matching the combined dashboard — never today's
  // rate for a historical period.
  const asOf = range?.to ?? new Date();
  const rates = await resolveRates(entities, reportingCurrency, asOf);
  const total = combineRegions(regions, rates);

  return {
    departmentId: department.id,
    departmentName: department.name,
    reportingCurrency,
    regions,
    total,
    rates,
  };
}

export interface DepartmentCard {
  id: string;
  name: string;
  /** Converted revenue and spend for the card face. Null when a rate is missing. */
  revenue: Prisma.Decimal | null;
  spent: Prisma.Decimal | null;
  net: Prisma.Decimal | null;
  entryCount: number;
}

/**
 * Every department with a headline figure, for the picker.
 *
 * Departments with no activity in the period are still listed — a team that
 * booked nothing this month is a finding, not a row to hide.
 */
export async function listDepartmentCards(
  reportingCurrency: Currency,
  range?: DateRange
): Promise<DepartmentCard[]> {
  // Departments, entities, and the FX rate all previously got re-fetched
  // once PER department by calling getDepartmentRegional in a loop — the
  // entity list and the rate are the same for every card, so that was N
  // redundant round trips for one page. Fetched once here and reused.
  const [departments, entities] = await Promise.all([
    prisma.department.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.businessEntity.findMany({ where: { status: "ACTIVE" }, orderBy: { code: "asc" } }),
  ]);

  const asOf = range?.to ?? new Date();
  const rates = await resolveRates(entities, reportingCurrency, asOf);

  return Promise.all(
    departments.map(async (d) => {
      const regions = await Promise.all(entities.map((e) => figuresForEntity(e, d.id, range)));
      const total = combineRegions(regions, rates);
      return {
        id: d.id,
        name: d.name,
        revenue: total.available ? total.revenue : null,
        spent: total.available ? total.spent : null,
        net: total.available ? total.net : null,
        entryCount: regions.reduce((n, r) => n + r.inflowCount + r.outflowCount, 0),
      };
    })
  );
}
