import Link from "next/link";
import { requireEntityBySlug } from "@/lib/entities";
import { requireUser, canWriteEntity } from "@/lib/rbac";
import { listMonths } from "@/services/finance/ledger-months";
import { ExportMenu } from "@/components/finance/export-menu";
import { MonthCards } from "@/components/finance/month-cards";
import { Button } from "@/components/ui/button";

/**
 * Inflow, organised by month rather than as one long list.
 *
 * Mirrors the workbook: one sheet per month. The flat list is still there
 * under /all, because cross-month questions ("what's uncollected?") can't be
 * answered from a single month.
 */
export default async function InflowMonthsPage({ params }: { params: Promise<{ entityCode: string }> }) {
  const { entityCode } = await params;
  const entity = await requireEntityBySlug(entityCode);
  const user = await requireUser();
  const canWrite = canWriteEntity(user.role, entity.code);

  // Empty shells are filtered out: a card with nothing behind it is noise,
  // and creating a month already drops you straight into its sheet.
  const months = (await listMonths(entity.id, "INFLOW")).filter((m) => m.rowCount > 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-section-title">Inflow Tracker</h2>
          <p className="mt-0.5 text-page-subtitle">Clients closed and payments received, one sheet per month.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu entityId={entity.id} type="INFLOW" />
          <Link href={`/operations/${entityCode}/inflow/all`}>
            <Button size="sm" variant="outline">
              All records
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-5">
        <MonthCards
          months={months.map((m) => ({
            key: m.key,
            year: m.year,
            month: m.month,
            total: m.total.toNumber(),
            settled: m.settled.toNumber(),
            outstanding: m.outstanding.toNumber(),
            rowCount: m.rowCount,
            isEmpty: m.isEmpty,
          }))}
          entityCode={entityCode}
          currency={entity.baseCurrency}
          basePath={`/operations/${entityCode}/inflow`}
          canWrite={canWrite}
          totalLabel="Deal value"
          settledLabel="Received"
        />
      </div>
    </div>
  );
}
