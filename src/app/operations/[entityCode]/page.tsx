import { ArrowDownToLine, ArrowUpFromLine, Clock, Users2, Building2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireEntityBySlug } from "@/lib/entities";
import { formatMoneyCompact } from "@/lib/format";
import { getInflowSummary, getOutflowSummary } from "@/services/finance/summary";
import { OperationCard } from "@/components/finance/operation-card";
import { ExportMenu } from "@/components/finance/export-menu";

export default async function EntityOperationsHome({
  params,
}: {
  params: Promise<{ entityCode: string }>;
}) {
  const { entityCode } = await params;
  const entity = await requireEntityBySlug(entityCode);
  const base = `/operations/${entityCode}`;

  const [inflow, outflow, clientCount, vendorCount, pendingCount] = await Promise.all([
    getInflowSummary(entity.id),
    getOutflowSummary(entity.id),
    prisma.client.count({ where: { entityId: entity.id } }),
    prisma.vendor.count({ where: { entityId: entity.id } }),
    prisma.financialTransaction.count({
      where: { entityId: entity.id, transactionType: "OUTFLOW", status: { not: "PAID" } },
    }),
  ]);

  return (
    <div>
      {/* Download point for the accounts team — the Excel option is the same
          Payment Tracker / Inflow Tracker workbook they already work in. */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-metadata">Download this entity&rsquo;s trackers, or a formatted report.</p>
        <ExportMenu entityId={entity.id} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <OperationCard
        label="Inflow"
        value={formatMoneyCompact(inflow.totalReceived, entity.baseCurrency)}
        meta={`${inflow.clientsClosed} record${inflow.clientsClosed === 1 ? "" : "s"} · all time`}
        icon={ArrowDownToLine}
        tone="success"
        actionLabel="Add inflow"
        actionHref={`${base}/inflow/new`}
      />
      <OperationCard
        label="Outflow"
        value={formatMoneyCompact(outflow.totalDue, entity.baseCurrency)}
        meta={`${outflow.itemCount} record${outflow.itemCount === 1 ? "" : "s"} · all time`}
        icon={ArrowUpFromLine}
        actionLabel="Add expense"
        actionHref={`${base}/outflow/new`}
      />
      <OperationCard
        label="Pending"
        value={formatMoneyCompact(outflow.totalPending, entity.baseCurrency)}
        meta={`${pendingCount} payment${pendingCount === 1 ? "" : "s"} pending`}
        icon={Clock}
        tone="warning"
        actionLabel="Review"
        actionHref={`${base}/outflow`}
      />
      <OperationCard
        label="Clients"
        value={String(clientCount)}
        icon={Building2}
        tone="brand"
        actionLabel="View clients"
        actionHref={`${base}/clients`}
      />
      <OperationCard
        label="Vendors"
        value={String(vendorCount)}
        icon={Users2}
        actionLabel="View vendors"
        actionHref={`${base}/vendors`}
      />
      </div>
    </div>
  );
}
