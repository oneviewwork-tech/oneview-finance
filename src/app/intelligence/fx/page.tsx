import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { requireUser, canManageFx } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ManualRateForm } from "./manual-rate-form";
import { RefreshRateButton } from "./refresh-rate-button";

export default async function FxManagementPage() {
  const user = await requireUser();
  const canManage = canManageFx(user.role);
  const rates = await prisma.exchangeRate.findMany({
    orderBy: [{ rateDate: "desc" }, { createdAt: "desc" }],
    take: 30,
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-page-title">Exchange Rate</h1>
        <p className="mt-1 text-page-subtitle">
          AED ↔ INR conversion used by the Combined dashboard. Live rates are fetched automatically once per day; a
          manual entry for a given date always takes precedence over that date&rsquo;s live rate.
        </p>
      </div>

      {canManage && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Refresh live rate</CardTitle>
            </CardHeader>
            <CardContent>
              <RefreshRateButton />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add a manual rate</CardTitle>
            </CardHeader>
            <CardContent>
              <ManualRateForm />
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Rate history</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Date</th>
                <th className="py-2">Pair</th>
                <th className="py-2 text-right">Rate</th>
                <th className="py-2">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rates.map((r) => (
                <tr key={r.id}>
                  <td className="py-2">{formatDate(r.rateDate)}</td>
                  <td className="py-2">
                    {r.baseCurrency} → {r.quoteCurrency}
                  </td>
                  <td className="py-2 text-right tabular-nums">{r.rate.toString()}</td>
                  <td className="py-2">
                    <Badge variant={r.source === "MANUAL" ? "brand" : "neutral"}>{r.source}</Badge>
                  </td>
                </tr>
              ))}
              {rates.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    No rates recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
