import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { entitySlug } from "@/lib/entities";
import { requireEntityAccess } from "@/lib/rbac";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { calculateCollectedFraction } from "@/domain/finance/calculations";
import { weekLabel } from "@/domain/finance/period";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { RecordPaymentForm } from "./record-payment-form";
import { ReversePaymentButton } from "./reverse-payment-button";

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [txn, paymentMethods] = await Promise.all([
    prisma.financialTransaction.findUnique({
      where: { id },
      include: {
        entity: true,
        client: { include: { clientType: true } },
        vendor: true,
        category: true,
        expenseType: true,
        payments: { include: { paymentMethod: true }, orderBy: { paymentDate: "asc" } },
        createdBy: { select: { name: true, email: true } },
      },
    }),
    prisma.paymentMethod.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  if (!txn) notFound();
  await requireEntityAccess(txn.entity.code);

  const balance = txn.originalAmount.minus(txn.paidAmount);
  const isInflow = txn.transactionType === "INFLOW";
  const slug = entitySlug(txn.entity.code);
  const listHref = isInflow ? `/operations/${slug}/inflow` : `/operations/${slug}/outflow`;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={listHref} className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to {isInflow ? "Inflow" : "Outflow"}
      </Link>

      <div className="mt-3 flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {txn.entity.name} · {isInflow ? "Inflow" : "Outflow"}
            {!isInflow && ` · ${weekLabel(txn.transactionDate)}`}
          </p>
          <h1 className="text-page-title">{txn.description}</h1>
        </div>
        <StatusBadge status={txn.status} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label={isInflow ? "Deal Value" : "Amount Due"} value={formatMoney(txn.originalAmount, txn.originalCurrency)} />
        <SummaryTile
          label={isInflow ? "Received" : "Paid"}
          value={formatMoney(txn.paidAmount, txn.originalCurrency)}
          tone="success"
        />
        <SummaryTile
          label="Balance"
          value={formatMoney(balance, txn.originalCurrency)}
          tone={balance.gt(0) ? "warning" : "default"}
        />
        <SummaryTile
          label={isInflow ? "% Collected" : "% Settled"}
          value={formatPercent(calculateCollectedFraction(txn.originalAmount, txn.paidAmount))}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">Date</p>
            <p>{formatDate(txn.transactionDate)}</p>
          </div>
          {isInflow ? (
            <>
              <div>
                <p className="text-muted-foreground">Client</p>
                <p>{txn.client?.name ?? "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Client Type</p>
                <p>{txn.client?.clientType?.name ?? "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Closed By (BD)</p>
                <p>{txn.closedByName ?? "-"}</p>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-muted-foreground">Category</p>
                <p>{txn.category?.name ?? "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Type</p>
                <p>{txn.expenseType?.name ?? "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Vendor</p>
                <p>{txn.vendor?.name ?? "-"}</p>
              </div>
            </>
          )}
          <div>
            <p className="text-muted-foreground">Reference No.</p>
            <p>{txn.referenceNumber ?? "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Remarks</p>
            <p>{txn.remarks ?? "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Entered by</p>
            <p>{txn.createdBy.name}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Payment history</CardTitle>
        </CardHeader>
        <CardContent>
          {txn.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Date</th>
                  <th className="py-2 text-right">Amount</th>
                  <th className="py-2">Mode</th>
                  <th className="py-2">Reference</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {txn.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="py-2">{formatDate(payment.paymentDate)}</td>
                    <td className="py-2 text-right">{formatMoney(payment.amount, payment.currency)}</td>
                    <td className="py-2 text-muted-foreground">{payment.paymentMethod?.name ?? "-"}</td>
                    <td className="py-2 text-muted-foreground">{payment.referenceNumber ?? "-"}</td>
                    <td className="py-2 text-right">
                      <ReversePaymentButton paymentId={payment.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {txn.status !== "PAID" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Record a payment</CardTitle>
          </CardHeader>
          <CardContent>
            <RecordPaymentForm transactionId={txn.id} currency={txn.originalCurrency} paymentMethods={paymentMethods} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Compact figure tile — replaces four Card+Header+Content stacks that were
    doing nothing but showing a label and a number. */
function SummaryTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-metadata">{label}</p>
      <p
        className={
          tone === "success"
            ? "mt-1 text-metric-sm text-success"
            : tone === "warning"
              ? "mt-1 text-metric-sm text-warning"
              : "mt-1 text-metric-sm"
        }
      >
        {value}
      </p>
    </div>
  );
}
