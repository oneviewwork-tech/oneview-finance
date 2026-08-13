import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireEntityBySlug } from "@/lib/entities";
import { calculateCollectedFraction } from "@/domain/finance/calculations";
import { parseStatusFilter, statusWhereClause, describeStatusFilter } from "@/domain/finance/transaction-filter";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/finance/export-menu";
import { ActiveFilterChip } from "@/components/finance/active-filter-chip";
import { InflowTable } from "./inflow-table";

export default async function InflowListPage({
  params,
  searchParams,
}: {
  params: Promise<{ entityCode: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { entityCode } = await params;
  const { status } = await searchParams;
  const entity = await requireEntityBySlug(entityCode);

  // Lets a dashboard tile deep-link into the rows behind its number.
  const filter = parseStatusFilter(status);
  const statusClause = statusWhereClause(filter);

  const transactions = await prisma.financialTransaction.findMany({
    where: {
      entityId: entity.id,
      transactionType: "INFLOW",
      ...(statusClause ? { status: statusClause } : {}),
    },
    include: { client: true },
    orderBy: { transactionDate: "desc" },
    take: 200,
  });

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
        <h2 className="text-section-title">Inflow · clients closed and payments received</h2>
        <div className="flex items-center gap-2">
          <ExportMenu entityId={entity.id} type="INFLOW" />
          <Link href={`/operations/${entityCode}/inflow/new`}>
            <Button size="sm">Add inflow</Button>
          </Link>
        </div>
      </div>

      {filter && (
        <div className="mt-3">
          <ActiveFilterChip
            label={describeStatusFilter(filter)}
            clearHref={`/operations/${entityCode}/inflow`}
          />
        </div>
      )}

      <div className="mt-4">
        <InflowTable rows={rows} entityCode={entityCode} entityName={entity.name} />
      </div>
    </div>
  );
}
