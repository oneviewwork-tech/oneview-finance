import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireEntityBySlug } from "@/lib/entities";
import { parseStatusFilter, statusWhereClause, describeStatusFilter } from "@/domain/finance/transaction-filter";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/finance/export-menu";
import { ActiveFilterChip } from "@/components/finance/active-filter-chip";
import { OutflowTable } from "./outflow-table";

export default async function OutflowListPage({
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
      <div className="flex items-center justify-between">
        <h2 className="text-section-title">Outflow · expenses and payments</h2>
        <div className="flex items-center gap-2">
          <ExportMenu entityId={entity.id} type="OUTFLOW" />
          <Link href={`/operations/${entityCode}/outflow/new`}>
            <Button size="sm">Add expense</Button>
          </Link>
        </div>
      </div>

      {filter && (
        <div className="mt-3">
          <ActiveFilterChip
            label={describeStatusFilter(filter)}
            clearHref={`/operations/${entityCode}/outflow`}
          />
        </div>
      )}

      <div className="mt-4">
        <OutflowTable rows={rows} entityCode={entityCode} entityName={entity.name} />
      </div>
    </div>
  );
}
