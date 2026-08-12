import Link from "next/link";
import { Building2, ArrowDownToLine, ArrowUpFromLine, Upload, Database, UserCog, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { entitySlug } from "@/lib/entities";
import { formatMoney } from "@/lib/format";
import { getInflowSummary, getOutflowSummary } from "@/services/finance/summary";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireUser, canAccessEntityData, canManageMasterData, canManageUsers } from "@/lib/rbac";

export default async function OperationsHome() {
  const user = await requireUser();
  const allEntities = await prisma.businessEntity.findMany({ orderBy: { code: "asc" } });
  const entities = allEntities.filter((e) => canAccessEntityData(user.role, e.code));

  const entityCards = await Promise.all(
    entities.map(async (entity) => {
      const [inflow, outflow, clientCount, vendorCount] = await Promise.all([
        getInflowSummary(entity.id),
        getOutflowSummary(entity.id),
        prisma.client.count({ where: { entityId: entity.id } }),
        prisma.vendor.count({ where: { entityId: entity.id } }),
      ]);
      return { entity, inflow, outflow, clientCount, vendorCount };
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title">Accounts</h1>
        <p className="mt-1 text-page-subtitle">Enter and manage inflows, expenses and payments. This replaces the monthly Zoho Sheet.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {entityCards.map(({ entity, inflow, outflow, clientCount, vendorCount }) => {
          const slug = entitySlug(entity.code);
          return (
            <Link key={entity.id} href={`/operations/${slug}`} className="group">
              <Card interactive elevated className="h-full">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-subtle">
                        <Building2 className="h-5 w-5 text-brand" />
                      </div>
                      <div>
                        <h3 className="text-section-title">{entity.name}</h3>
                        <p className="text-metadata">
                          {entity.country} · <Badge variant="outline">{entity.baseCurrency}</Badge>
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border-subtle pt-4">
                    <div>
                      <p className="text-metadata">Inflow received</p>
                      <p className="mt-0.5 text-sm font-semibold text-success">{formatMoney(inflow.totalReceived, entity.baseCurrency)}</p>
                      <p className="text-metadata">{inflow.clientsClosed} deals</p>
                    </div>
                    <div>
                      <p className="text-metadata">Outflow pending</p>
                      <p className="mt-0.5 text-sm font-semibold text-warning">{formatMoney(outflow.totalPending, entity.baseCurrency)}</p>
                      <p className="text-metadata">{outflow.itemCount} items</p>
                    </div>
                    <div>
                      <p className="text-metadata">Clients</p>
                      <p className="mt-0.5 text-sm font-semibold">{clientCount}</p>
                    </div>
                    <div>
                      <p className="text-metadata">Vendors</p>
                      <p className="mt-0.5 text-sm font-semibold">{vendorCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {entities.length > 0 && (
        <div>
          <h2 className="mb-3 text-section-title">Quick Actions</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {entities.map((e) => {
              const slug = entitySlug(e.code);
              return (
                <div key={e.id} className="space-y-2">
                  <p className="text-label text-muted-foreground">{e.name}</p>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/operations/${slug}/inflow/new`}>
                      <Badge variant="brand" className="cursor-pointer transition-ui hover:opacity-80">
                        <ArrowDownToLine className="mr-1 h-3 w-3" />
                        Record Inflow
                      </Badge>
                    </Link>
                    <Link href={`/operations/${slug}/outflow/new`}>
                      <Badge variant="outline" className="cursor-pointer transition-ui hover:bg-accent">
                        <ArrowUpFromLine className="mr-1 h-3 w-3" />
                        Record Outflow
                      </Badge>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-section-title">Global Tools</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/operations/import">
            <Card interactive className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <Upload className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Import</p>
                <p className="text-metadata">Zoho Sheets data</p>
              </div>
            </Card>
          </Link>
          {canManageMasterData(user.role) && (
            <Link href="/operations/categories">
              <Card interactive className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                  <Database className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Master Data</p>
                  <p className="text-metadata">Categories & departments</p>
                </div>
              </Card>
            </Link>
          )}
          {canManageUsers(user.role) && (
            <Link href="/operations/users">
              <Card interactive className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                  <UserCog className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Users</p>
                  <p className="text-metadata">Manage access</p>
                </div>
              </Card>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
