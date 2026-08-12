import { prisma } from "@/lib/prisma";
import { requireUser, canWriteEntity } from "@/lib/rbac";
import { ImportWizard } from "./import-wizard";

export default async function ImportPage() {
  const user = await requireUser();
  const allEntities = await prisma.businessEntity.findMany({ orderBy: { code: "asc" } });
  const entities = allEntities.filter((e) => canWriteEntity(user.role, e.code));

  return (
    <div className="max-w-4xl">
      <h1 className="text-page-title">Import from Zoho Sheets</h1>
      <p className="mt-1 text-page-subtitle">
        Upload a ONEVIEW Finance-format workbook (Payment Tracker + Inflow Tracker sheets). Nothing is written to the
        database until you review the preview and confirm.
      </p>
      <ImportWizard entities={entities} />
    </div>
  );
}
