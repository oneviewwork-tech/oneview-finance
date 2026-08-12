import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireEntityBySlug } from "@/lib/entities";
import { requireEntityAccess } from "@/lib/rbac";
import { TabNav } from "@/components/ui/tab-nav";

export default async function EntityOperationsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ entityCode: string }>;
}) {
  const { entityCode } = await params;
  const entity = await requireEntityBySlug(entityCode);
  await requireEntityAccess(entity.code);
  const base = `/operations/${entityCode}`;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/operations"
            className="mb-1 inline-flex items-center gap-0.5 text-metadata transition-ui hover:text-foreground"
          >
            <ChevronLeft className="h-3 w-3" />
            Accounts
          </Link>
          <h1 className="text-page-title">
            {entity.name} <span className="font-normal text-muted-foreground">· {entity.baseCurrency}</span>
          </h1>
        </div>
      </div>

      <div className="mt-4">
        <TabNav
          items={[
            { href: base, label: "Overview" },
            { href: `${base}/inflow`, label: "Inflow", matchPrefix: true },
            { href: `${base}/outflow`, label: "Outflow", matchPrefix: true },
            { href: `${base}/clients`, label: "Clients", matchPrefix: true },
            { href: `${base}/vendors`, label: "Vendors", matchPrefix: true },
          ]}
        />
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}
