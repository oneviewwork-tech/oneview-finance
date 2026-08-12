import { prisma } from "@/lib/prisma";
import { ImportWizard } from "./import-wizard";

export default async function ImportPage() {
  const entities = await prisma.businessEntity.findMany({ orderBy: { code: "asc" } });

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold">Import from Zoho Sheets</h1>
      <p className="mt-1 text-muted-foreground">
        Upload a ONEVIEW Finance-format workbook (Payment Tracker + Inflow Tracker sheets). Nothing is written to the
        database until you review the preview and confirm.
      </p>
      <ImportWizard entities={entities} />
    </div>
  );
}
