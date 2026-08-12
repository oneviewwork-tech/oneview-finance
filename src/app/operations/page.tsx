import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { entitySlug } from "@/lib/entities";
import { formatMoneyCompact } from "@/lib/format";
import { getInflowSummary, getOutflowSummary } from "@/services/finance/summary";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser, canAccessEntityData, canManageMasterData } from "@/lib/rbac";

export default async function OperationsHome() {
  const user = await requireUser();
  const allEntities = await prisma.businessEntity.findMany({ orderBy: { code: "asc" } });
  const entities = allEntities.filter((e) => canAccessEntityData(user.role, e.code));

  const entitiesWithSummary = await Promise.all(
    entities.map(async (entity) => {
      const [inflow, outflow] = await Promise.all([getInflowSummary(entity.id), getOutflowSummary(entity.id)]);
      return { entity, inflow, outflow };
    })
  );

  return (
    <div>
      <h1 className="text-page-title">Accounts</h1>
      <p className="text-page-subtitle">Enter and manage inflows, expenses and payments. This replaces the monthly Zoho Sheet.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {entitiesWithSummary.map(({ entity, inflow, outflow }) => (
          <Link key={entity.id} href={`/operations/${entitySlug(entity.code)}`}>
            <Card interactive className="p-0">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-section-title">{entity.name}</p>
                    <p className="text-metadata">
                      {entity.country} · {entity.baseCurrency}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border-subtle pt-3">
                  <div>
                    <p className="text-metadata">Inflow received</p>
                    <p className="mt-0.5 text-metric-sm">{formatMoneyCompact(inflow.totalReceived, entity.baseCurrency)}</p>
                  </div>
                  <div>
                    <p className="text-metadata">Outflow pending</p>
                    <p className="mt-0.5 text-metric-sm">{formatMoneyCompact(outflow.totalPending, entity.baseCurrency)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {canManageMasterData(user.role) && (
        <Link href="/operations/categories" className="mt-5 inline-block text-label font-medium text-brand transition-ui hover:underline">
          Manage master data (categories, expense types, payment methods, client types) →
        </Link>
      )}
    </div>
  );
}
