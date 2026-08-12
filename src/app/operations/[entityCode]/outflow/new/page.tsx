import { prisma } from "@/lib/prisma";
import { requireEntityBySlug } from "@/lib/entities";
import { OutflowForm } from "./outflow-form";

export default async function NewOutflowPage({ params }: { params: Promise<{ entityCode: string }> }) {
  const { entityCode } = await params;
  const entity = await requireEntityBySlug(entityCode);

  const [categories, expenseTypes, vendors, departments, paymentMethods] = await Promise.all([
    prisma.financialCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.expenseType.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.vendor.findMany({ where: { entityId: entity.id, status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.paymentMethod.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold">Add expense · {entity.name}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Paid in full? Tick &ldquo;Pay in full&rdquo;. Paid part of it? Enter the actual amount paid. Not paid yet? Leave
        both blank. Status and Balance are calculated automatically.
      </p>
      <OutflowForm
        entityCode={entityCode}
        entityId={entity.id}
        currency={entity.baseCurrency}
        categories={categories}
        expenseTypes={expenseTypes}
        vendors={vendors}
        departments={departments}
        paymentMethods={paymentMethods}
      />
    </div>
  );
}
