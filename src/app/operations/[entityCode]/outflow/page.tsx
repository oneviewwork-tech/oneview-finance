import Link from "next/link";
import { requireEntityBySlug } from "@/lib/entities";
import { requireUser, canWriteEntity } from "@/lib/rbac";
import { listMonths } from "@/services/finance/ledger-months";
import { ExportMenu } from "@/components/finance/export-menu";
import { MonthCards } from "@/components/finance/month-cards";
import { Button } from "@/components/ui/button";

/**
 * Outflow, organised by month rather than as one long list.
 *
 * The workbook is one file per month and people ask "what did we owe in
 * August", not "show me every expense ever" — a flat 200-row table made
 * finding and correcting a single line a hunt.
 */
export default async function OutflowMonthsPage({ params }: { params: Promise<{ entityCode: string }> }) {
  const { entityCode } = await params;
  const entity = await requireEntityBySlug(entityCode);
  const user = await requireUser();
  const canWrite = canWriteEntity(user.role, entity.code);

  // Empty shells are filtered out: a card with nothing behind it is noise,
  // and creating a month already drops you straight into its sheet.
  const months = (await listMonths(entity.id, "OUTFLOW")).filter((m) => m.rowCount > 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-section-title">Payment Tracker</h2>
          <p className="mt-0.5 text-page-subtitle">Expenses and payments, one sheet per month.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu entityId={entity.id} type="OUTFLOW" />
          <Link href={`/operations/${entityCode}/outflow/all`}>
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
          basePath={`/operations/${entityCode}/outflow`}
          canWrite={canWrite}
          totalLabel="Total due"
          settledLabel="Paid"
        />
      </div>
    </div>
  );
}
