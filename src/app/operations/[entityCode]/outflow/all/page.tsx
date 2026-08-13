import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireEntityBySlug } from "@/lib/entities";
import {
  statusWhereClause,
  parseRecordFilters,
  hasAnyFilter,
  describeRecordFilters,
} from "@/domain/finance/transaction-filter";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/finance/export-menu";
import { ActiveFilterChip } from "@/components/finance/active-filter-chip";
import { OutflowTable } from "../outflow-table";

/**
 * Every outflow row, across all months.
 *
 * Kept alongside the monthly sheets because the dashboard's KPI tiles drill
 * in here with a status filter ("show me what's unpaid") — a question that
 * spans months and would be unanswerable from a single month's sheet.
 */
export default async function OutflowAllRecordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ entityCode: string }>;
  searchParams: Promise<{ status?: string; category?: string; department?: string }>;
}) {
  const { entityCode } = await params;
  const query = await searchParams;
  const entity = await requireEntityBySlug(entityCode);

  const filters = parseRecordFilters(query);
  const statusClause = statusWhereClause(filters.status);

  const transactions = await prisma.financialTransaction.findMany({
    where: {
      entityId: entity.id,
      transactionType: "OUTFLOW",
      ...(statusClause ? { status: statusClause } : {}),
      // Category and department narrow the list the same way the card that
      // linked here narrowed its number, so the two agree.
      ...(filters.categoryNames ? { category: { name: { in: filters.categoryNames } } } : {}),
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters.untaggedDepartment ? { departmentId: null } : {}),
    },
    include: { category: true, expenseType: true },
    orderBy: { transactionDate: "desc" },
    take: 200,
  });

  const department = filters.departmentId
    ? await prisma.department.findUnique({ where: { id: filters.departmentId }, select: { name: true } })
    : null;

  const rows = transactions.map((txn) => ({
    id: txn.id,
    transactionDate: txn.transactionDate.toISOString(),
    description: txn.description,
    categoryName: txn.category?.name ?? "-",
    expenseTypeName: txn.expenseType?.name ?? "-",
    amountDue: txn.originalAmount.toNumber(),
    paid: txn.paidAmount.toNumber(),
    status: txn.status,
    currency: txn.originalCurrency,
  }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-section-title">Outflow · all records</h2>
          <p className="mt-0.5 text-page-subtitle">
            Every entry across all months. For day-to-day entry, use the monthly sheets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu entityId={entity.id} type="OUTFLOW" />
          <Link href={`/operations/${entityCode}/outflow`}>
            <Button size="sm" variant="outline">
              Monthly sheets
            </Button>
          </Link>
        </div>
      </div>

      {hasAnyFilter(filters) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ActiveFilterChip
            label={describeRecordFilters(filters, department?.name).join(" · ")}
            clearHref={`/operations/${entityCode}/outflow/all`}
          />
        </div>
      )}

      <div className="mt-4">
        <OutflowTable rows={rows} entityCode={entityCode} entityName={entity.name} />
      </div>
    </div>
  );
}
