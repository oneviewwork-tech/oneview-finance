import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireEntityBySlug } from "@/lib/entities";
import { calculateCollectedFraction } from "@/domain/finance/calculations";
import {
  statusWhereClause,
  parseRecordFilters,
  hasAnyFilter,
  describeRecordFilters,
} from "@/domain/finance/transaction-filter";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/finance/export-menu";
import { ActiveFilterChip } from "@/components/finance/active-filter-chip";
import { InflowTable } from "../inflow-table";

/**
 * Every inflow row, across all months.
 *
 * Also where a Department View row lands when clicked: department detail
 * shows Revenue, Received, Outstanding for each region, and each of those
 * is a filtered view of these same rows, not a separately-computed number.
 */
export default async function InflowAllRecordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ entityCode: string }>;
  searchParams: Promise<{ status?: string; department?: string }>;
}) {
  const { entityCode } = await params;
  const query = await searchParams;
  const entity = await requireEntityBySlug(entityCode);

  const filters = parseRecordFilters(query);
  const statusClause = statusWhereClause(filters.status);

  const transactions = await prisma.financialTransaction.findMany({
    where: {
      entityId: entity.id,
      transactionType: "INFLOW",
      ...(statusClause ? { status: statusClause } : {}),
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters.untaggedDepartment ? { departmentId: null } : {}),
    },
    include: { client: true },
    orderBy: { transactionDate: "desc" },
    take: 200,
  });

  const department = filters.departmentId
    ? await prisma.department.findUnique({ where: { id: filters.departmentId }, select: { name: true } })
    : null;

  const rows = transactions.map((txn) => ({
    id: txn.id,
    transactionDate: txn.transactionDate.toISOString(),
    clientName: txn.client?.name ?? "-",
    description: txn.description,
    dealValue: txn.originalAmount.toNumber(),
    received: txn.paidAmount.toNumber(),
    collectedFraction: calculateCollectedFraction(txn.originalAmount, txn.paidAmount).toNumber(),
    status: txn.status,
    currency: txn.originalCurrency,
  }));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-section-title">Inflow · all records</h2>
          <p className="mt-0.5 text-page-subtitle">
            Every entry across all months. For day-to-day entry, use the monthly sheets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu entityId={entity.id} type="INFLOW" />
          <Link href={`/operations/${entityCode}/inflow`}>
            <Button size="sm" variant="outline">Monthly sheets</Button>
          </Link>
        </div>
      </div>

      {hasAnyFilter(filters) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ActiveFilterChip
            label={describeRecordFilters(filters, department?.name).join(" · ")}
            clearHref={`/operations/${entityCode}/inflow/all`}
          />
        </div>
      )}

      <div className="mt-4">
        <InflowTable rows={rows} entityCode={entityCode} entityName={entity.name} />
      </div>
    </div>
  );
}
