import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireEntityBySlug } from "@/lib/entities";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/finance/export-button";
import { OutflowTable } from "./outflow-table";

export default async function OutflowListPage({ params }: { params: Promise<{ entityCode: string }> }) {
  const { entityCode } = await params;
  const entity = await requireEntityBySlug(entityCode);

  const transactions = await prisma.financialTransaction.findMany({
    where: { entityId: entity.id, transactionType: "OUTFLOW" },
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
          <ExportButton entityId={entity.id} type="OUTFLOW" />
          <Link href={`/operations/${entityCode}/outflow/new`}>
            <Button size="sm">Add expense</Button>
          </Link>
        </div>
      </div>

      <div className="mt-4">
        <OutflowTable rows={rows} entityCode={entityCode} entityName={entity.name} />
      </div>
    </div>
  );
}
