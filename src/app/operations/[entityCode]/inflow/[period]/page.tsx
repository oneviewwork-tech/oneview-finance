import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireEntityBySlug } from "@/lib/entities";
import { requireUser, canWriteEntity } from "@/lib/rbac";
import { parsePeriodKey, periodRange } from "@/domain/finance/period";
import { LedgerGrid, type GridColumn } from "@/components/finance/ledger-grid";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * The Inflow Tracker for one month, editable in place.
 *
 * Columns follow src/domain/import/workbook-layout.ts, the same source the
 * importer and exporter use.
 */
export default async function InflowMonthPage({
  params,
}: {
  params: Promise<{ entityCode: string; period: string }>;
}) {
  const { entityCode, period: periodKey } = await params;
  const period = parsePeriodKey(periodKey);
  if (!period) notFound();

  const entity = await requireEntityBySlug(entityCode);
  const user = await requireUser();
  const canWrite = canWriteEntity(user.role, entity.code);
  const cur = entity.baseCurrency;

  const range = periodRange(period);
  const [transactions, clients, clientTypes, departments, paymentMethods] = await Promise.all([
    prisma.financialTransaction.findMany({
      where: {
        entityId: entity.id,
        transactionType: "INFLOW",
        transactionDate: { gte: range.from, lte: range.to },
      },
      include: { client: true, payments: { orderBy: { paymentDate: "desc" }, take: 1 } },
      orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.client.findMany({ where: { entityId: entity.id, status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.clientType.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.paymentMethod.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  const opt = (xs: { id: string; name: string }[]) => xs.map((x) => ({ id: x.id, name: x.name }));

  const columns: GridColumn[] = [
    { field: "transactionDate", label: "Date Received", type: "date", width: "w-36" },
    { field: "clientId", label: "Client Name", type: "select", width: "w-48", options: opt(clients) },
    { field: "description", label: "Service / Project", type: "text", width: "min-w-[200px]" },
    { field: "clientTypeId", label: "Client Type", type: "select", width: "w-36", options: opt(clientTypes) },
    { field: "departmentId", label: "Department", type: "select", width: "w-40", options: opt(departments) },
    { field: "amount", label: `Deal Value (${cur})`, type: "money", width: "w-32" },
    { field: "paidAmount", label: `Amount Received (${cur})`, type: "money", width: "w-36" },
    { field: "balance", label: `Balance Due (${cur})`, type: "derived", width: "w-32" },
    { field: "percent", label: "% Collected", type: "derived", width: "w-28" },
    { field: "status", label: "Status", type: "derived", width: "w-24" },
    { field: "paymentMethodId", label: "Payment Mode", type: "select", width: "w-36", options: opt(paymentMethods) },
    { field: "referenceNumber", label: "Reference No.", type: "text", width: "w-36" },
    { field: "closedByName", label: "Closed By (BD)", type: "text", width: "w-36" },
    { field: "remarks", label: "Remarks", type: "text", width: "min-w-[160px]" },
  ];

  const rows = transactions.map((t) => ({
    id: t.id,
    transactionDate: iso(t.transactionDate),
    description: t.description,
    categoryId: null,
    expenseTypeId: null,
    departmentId: t.departmentId,
    clientId: t.clientId,
    clientName: t.client?.name ?? "",
    closedByName: t.closedByName ?? "",
    referenceNumber: t.referenceNumber ?? "",
    remarks: t.remarks ?? "",
    amount: t.originalAmount.toString(),
    paidAmount: t.paidAmount.toString(),
    week: "1",
    payFull: "N",
    paymentMethodId: t.payments[0]?.paymentMethodId ?? null,
    paymentDate: t.payments[0] ? iso(t.payments[0].paymentDate) : "",
    clientTypeId: t.client?.clientTypeId ?? null,
  }));

  return (
    <LedgerGrid
      period={period}
      entityCode={entityCode}
      entityName={entity.name}
      transactionType="INFLOW"
      currency={cur}
      columns={columns}
      initialRows={rows}
      canWrite={canWrite}
      backHref={`/operations/${entityCode}/inflow`}
      labels={{ title: "Inflow Tracker", total: "Total Deal Value", settled: "Received", outstanding: "Balance Due" }}
    />
  );
}
