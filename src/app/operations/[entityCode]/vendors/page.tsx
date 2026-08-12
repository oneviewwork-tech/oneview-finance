import { prisma } from "@/lib/prisma";
import { requireEntityBySlug } from "@/lib/entities";
import { VendorForm } from "./vendor-form";
import { VendorsTable } from "./vendors-table";

export default async function VendorsPage({ params }: { params: Promise<{ entityCode: string }> }) {
  const { entityCode } = await params;
  const entity = await requireEntityBySlug(entityCode);

  const vendors = await prisma.vendor.findMany({ where: { entityId: entity.id }, orderBy: { name: "asc" } });
  const rows = vendors.map((v) => ({ id: v.id, name: v.name, country: v.country, status: v.status }));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h2 className="text-section-title">Vendors · {entity.name}</h2>
        <div className="mt-4">
          <VendorsTable rows={rows} />
        </div>
      </div>
      <div>
        <h3 className="text-card-title">Add vendor</h3>
        <VendorForm entityId={entity.id} />
      </div>
    </div>
  );
}
