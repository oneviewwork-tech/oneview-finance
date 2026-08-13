import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireEntityBySlug } from "@/lib/entities";
import { requireUser, canWriteEntity } from "@/lib/rbac";
import { parsePeriodKey, periodRange, weekOfMonth } from "@/domain/finance/period";
import { LedgerGrid, WEEK_CHOICES, PAY_FULL_CHOICES, type GridColumn } from "@/components/finance/ledger-grid";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * The Payment Tracker for one month, editable in place.
 *
 * Columns follow src/domain/import/workbook-layout.ts — the same source the
 * importer and exporter use — so the on-screen sheet, the file you import
 * and the file you export all agree on what each column is.
 */
export default async function OutflowMonthPage({
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
  const [transactions, categories, expenseTypes, departments, paymentMethods] = await Promise.all([
    prisma.financialTransaction.findMany({
      where: {
        entityId: entity.id,
        transactionType: "OUTFLOW",
        transactionDate: { gte: range.from, lte: range.to },
      },
      include: { payments: { orderBy: { paymentDate: "desc" }, take: 1 } },
      orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.financialCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.expenseType.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.paymentMethod.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  const opt = (xs: { id: string; name: string }[]) => xs.map((x) => ({ id: x.id, name: x.name }));

  const columns: GridColumn[] = [
    { field: "week", label: "Week", type: "select", width: "w-28", options: WEEK_CHOICES },
    { field: "description", label: "Expense Item", type: "text", width: "min-w-[220px]" },
    { field: "categoryId", label: "Category", type: "select", width: "w-44", options: opt(categories) },
    { field: "expenseTypeId", label: "Type", type: "select", width: "w-36", options: opt(expenseTypes) },
    { field: "departmentId", label: "Department", type: "select", width: "w-40", options: opt(departments) },
    { field: "amount", label: `Amount Due (${cur})`, type: "money", width: "w-32" },
    { field: "paidAmount", label: `Amount Paid (${cur})`, type: "money", width: "w-32" },
    { field: "payFull", label: "Pay Full?", type: "select", width: "w-24", options: PAY_FULL_CHOICES },
    { field: "balance", label: `Balance (${cur})`, type: "derived", width: "w-32" },
    { field: "status", label: "Status", type: "derived", width: "w-24" },
    { field: "paymentDate", label: "Date Paid", type: "date", width: "w-36" },
    { field: "paymentMethodId", label: "Mode", type: "select", width: "w-36", options: opt(paymentMethods) },
    { field: "referenceNumber", label: "Reference No.", type: "text", width: "w-36" },
    { field: "remarks", label: "Remarks", type: "text", width: "min-w-[160px]" },
  ];

  const rows = transactions.map((t) => ({
    id: t.id,
    transactionDate: iso(t.transactionDate),
    description: t.description,
    categoryId: t.categoryId,
    expenseTypeId: t.expenseTypeId,
    departmentId: t.departmentId,
    clientId: null,
    clientName: "",
    closedByName: "",
    referenceNumber: t.referenceNumber ?? "",
    remarks: t.remarks ?? "",
    amount: t.originalAmount.toString(),
    paidAmount: t.paidAmount.toString(),
    week: String(weekOfMonth(t.transactionDate)),
    // Reflects reality rather than a stored flag: a fully settled row reads
    // as Y, exactly as the workbook's own column does.
    payFull: t.paidAmount.gte(t.originalAmount) && t.originalAmount.gt(0) ? "Y" : "N",
    paymentMethodId: t.payments[0]?.paymentMethodId ?? null,
    paymentDate: t.payments[0] ? iso(t.payments[0].paymentDate) : "",
    clientTypeId: null,
  }));

  return (
    <LedgerGrid
      period={period}
      entityCode={entityCode}
      entityName={entity.name}
      transactionType="OUTFLOW"
      currency={cur}
      columns={columns}
      initialRows={rows}
      canWrite={canWrite}
      backHref={`/operations/${entityCode}/outflow`}
      labels={{ title: "Payment Tracker", total: "Total Due", settled: "Paid", outstanding: "Pending" }}
    />
  );
}
