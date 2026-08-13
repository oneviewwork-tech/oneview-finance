import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireEntityBySlug } from "@/lib/entities";
import { parseStatusFilter, statusWhereClause, describeStatusFilter } from "@/domain/finance/transaction-filter";
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
  searchParams: Promise<{ status?: string }>;
}) {
  const { entityCode } = await params;
  const { status } = await searchParams;
  const entity = await requireEntityBySlug(entityCode);

  const filter = parseStatusFilter(status);
  const statusClause = statusWhereClause(filter);

  const transactions = await prisma.financialTransaction.findMany({
    where: {
      entityId: entity.id,
      transactionType: "OUTFLOW",
      ...(statusClause ? { status: statusClause } : {}),
    },
    include: { category: true, expenseType: true },
    orderBy: { transactionDate: "desc" },
    take: 200,
  });

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

      {filter && (
        <div className="mt-3">
          <ActiveFilterChip
            label={describeStatusFilter(filter)}
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
