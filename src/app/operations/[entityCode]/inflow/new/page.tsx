import { prisma } from "@/lib/prisma";
import { requireEntityBySlug } from "@/lib/entities";
import { InflowForm } from "./inflow-form";

export default async function NewInflowPage({ params }: { params: Promise<{ entityCode: string }> }) {
  const { entityCode } = await params;
  const entity = await requireEntityBySlug(entityCode);

  const [clients, clientTypes, paymentMethods, departments] = await Promise.all([
    prisma.client.findMany({ where: { entityId: entity.id, status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.clientType.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.paymentMethod.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold">Add inflow · {entity.name}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        One row per client deal. Partial receipts are fine. Balance Due and % Collected are calculated automatically.
      </p>
      <InflowForm
        entityCode={entityCode}
        entityId={entity.id}
        currency={entity.baseCurrency}
        clients={clients}
        clientTypes={clientTypes}
        paymentMethods={paymentMethods}
        departments={departments}
      />
    </div>
  );
}
