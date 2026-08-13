import { prisma } from "@/lib/prisma";
import { requireEntityBySlug } from "@/lib/entities";
import { ClientForm } from "./client-form";
import { ClientsTable } from "./clients-table";

export default async function ClientsPage({ params }: { params: Promise<{ entityCode: string }> }) {
  const { entityCode } = await params;
  const entity = await requireEntityBySlug(entityCode);

  const [clients, clientTypes] = await Promise.all([
    prisma.client.findMany({
      where: { entityId: entity.id },
      include: { clientType: true },
      orderBy: { name: "asc" },
    }),
    prisma.clientType.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  const rows = clients.map((client) => ({
    id: client.id,
    name: client.name,
    clientTypeName: client.clientType?.name ?? null,
    contact: client.contactEmail || client.contactPhone || null,
    status: client.status,
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h2 className="text-section-title">Clients · {entity.name}</h2>
        <div className="mt-4">
          <ClientsTable rows={rows} />
        </div>
      </div>
      <div>
        <h3 className="text-card-title">Add client</h3>
        <ClientForm entityId={entity.id} clientTypes={clientTypes} currency={entity.baseCurrency} />
      </div>
    </div>
  );
}
