import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Info } from "lucide-react";
import type { Currency } from "@prisma/client";
import { requireUser, canViewIntelligenceEntity, canAccessOperations } from "@/lib/rbac";
import { formatMoney } from "@/lib/format";
import { entitySlug } from "@/lib/entities";
import { cn } from "@/lib/utils";
import { parseRangeSelection, resolveSelection, describeSelectionLong } from "@/domain/finance/date-range";
import { SALARY_CATEGORY_NAMES } from "@/domain/finance/profitability";
import {
  getDepartmentRegional,
  type DepartmentRegionFigures,
  type DepartmentTotal,
  type DepartmentMoneyKey,
} from "@/services/finance/department-regional";
import { ensureTodayLiveRate } from "@/services/fx/exchange-rate.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * One department, region by region.
 *
 * Two questions sit side by side because they fail differently: revenue
 * against spend says whether the team earns more than it costs, while
 * revenue against collection says whether that revenue has turned into
 * money. A team can pass the first and fail the second — and only the
 * second one runs out of cash.
 */
export default async function DepartmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ departmentId: string }>;
  searchParams: Promise<{ currency?: string; range?: string; month?: string; from?: string; to?: string }>;
}) {
  const { departmentId } = await params;
  const query = await searchParams;
  const user = await requireUser();
  if (!canViewIntelligenceEntity(user.role, "ALL")) notFound();
  const showOpsLinks = canAccessOperations(user.role);

  const currency: Currency = query.currency === "AED" ? "AED" : "INR";
  const selection = parseRangeSelection(query);
  const range = resolveSelection(selection);
  const rangeLabel = describeSelectionLong(selection);

  await ensureTodayLiveRate();
  const result = await getDepartmentRegional(departmentId, currency, range);
  if (!result) notFound();

  const backQs = new URLSearchParams(
    Object.entries(query).filter((e): e is [string, string] => typeof e[1] === "string")
  );
  const total = result.total;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/intelligence/departments${backQs.toString() ? `?${backQs}` : ""}`}
          className="inline-flex items-center gap-1 text-metadata transition-ui hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          All departments
        </Link>
        <h1 className="mt-1 text-page-title">{result.departmentName}</h1>
        <p className="mt-0.5 text-page-subtitle">
          Across {result.regions.map((r) => r.entityName).join(" and ")}, {rangeLabel}. Reported in {currency}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue vs Spent</CardTitle>
          <CardDescription>
            What the team earned against what it cost. Revenue excludes tax, which is collected for the government
            rather than earned.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {/* Other expenses and Net have no href: there's no filter that
              accurately picks out "not salary" or "the rows behind a
              subtraction" — a link that quietly included the wrong rows
              would misrepresent the number worse than no link at all. */}
          <RegionTable
            regions={result.regions}
            currency={currency}
            total={total}
            showOpsLinks={showOpsLinks}
            rows={[
              {
                key: "revenue",
                label: "Revenue",
                tone: "success",
                recordsHref: (slug) => `/operations/${slug}/inflow/all?department=${departmentId}`,
              },
              {
                key: "salary",
                label: "Salary",
                recordsHref: (slug) =>
                  `/operations/${slug}/outflow/all?department=${departmentId}&category=${encodeURIComponent(SALARY_CATEGORY_NAMES.join(","))}`,
              },
              { key: "otherExpenses", label: "Other expenses" },
              {
                key: "spent",
                label: "Total spent",
                strong: true,
                recordsHref: (slug) => `/operations/${slug}/outflow/all?department=${departmentId}`,
              },
              { key: "net", label: "Net", strong: true, signed: true },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Revenue vs Collection</CardTitle>
          <CardDescription>
            How much of what was billed has actually arrived. Outstanding is gross — the client owes the tax too.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <RegionTable
            regions={result.regions}
            currency={currency}
            total={total}
            showOpsLinks={showOpsLinks}
            rows={[
              {
                key: "revenue",
                label: "Revenue billed",
                recordsHref: (slug) => `/operations/${slug}/inflow/all?department=${departmentId}`,
              },
              {
                key: "received",
                label: "Received",
                tone: "success",
                recordsHref: (slug) => `/operations/${slug}/inflow/all?department=${departmentId}&status=PAID`,
              },
              {
                key: "outstanding",
                label: "Outstanding",
                tone: "destructive",
                strong: true,
                recordsHref: (slug) => `/operations/${slug}/inflow/all?department=${departmentId}&status=unpaid`,
              },
            ]}
            footerLabel="Collected"
            footer={result.regions.map((r) =>
              r.revenue.eq(0) ? "—" : `${r.received.div(r.revenue).mul(100).toNumber().toFixed(1)}%`
            )}
            footerTotal={
              total.available && !total.revenue.eq(0)
                ? `${total.received.div(total.revenue).mul(100).toNumber().toFixed(1)}%`
                : "—"
            }
          />
        </CardContent>
      </Card>

      <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="text-sm text-muted-foreground">
          {total.available ? (
            <>
              The Total column is an FX conversion, not a sum — the regions keep their books in different currencies.
              Converted at{" "}
              {result.rates
                .filter((r) => !r.rate?.eq(1))
                .map((r) => `${r.entityCode} × ${r.rate?.toFixed(4)}`)
                .join(", ") || "parity"}
              , using the rate as of the end of the period rather than today&rsquo;s.
            </>
          ) : (
            <>
              No exchange rate is available for this period, so a Total cannot be shown. Each region&rsquo;s own
              figures above are still exact.{" "}
              <Link href="/intelligence/fx" className="font-medium text-brand hover:underline">
                Set a rate
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface RowSpec {
  /** Names the field on both a region and the total, so the two cannot
   *  drift apart the way a label-keyed lookup would. */
  key: DepartmentMoneyKey;
  label: string;
  tone?: "success" | "destructive";
  strong?: boolean;
  /** Colour by sign rather than a fixed tone. */
  signed?: boolean;
  /** Omitted where no filter can accurately express what makes up the
   *  number (see "Other expenses" and "Net" above). */
  recordsHref?: (entitySlug: string) => string;
}

function RegionTable({
  regions,
  currency,
  total,
  rows,
  footer,
  footerLabel,
  footerTotal,
  showOpsLinks,
}: {
  regions: DepartmentRegionFigures[];
  currency: Currency;
  total: DepartmentTotal;
  rows: RowSpec[];
  footer?: string[];
  footerLabel?: string;
  footerTotal?: string;
  showOpsLinks: boolean;
}) {
  return (
    <table className="w-full min-w-[520px] text-table">
      <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <th className="py-2 font-medium">Metric</th>
          {regions.map((r) => (
            <th key={r.entityCode} className="py-2 text-right font-medium">
              {r.entityName}
              <span className="ml-1 font-normal normal-case text-muted-foreground/70">({r.currency})</span>
            </th>
          ))}
          <th className="py-2 text-right font-medium">Total ({currency})</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border-subtle">
        {rows.map((row) => (
          <tr key={row.key + row.label} className="hover:bg-accent/40">
            {/* Plain text — this cell was previously decorated with an arrow
                implying IT was clickable, while the actual links sit in the
                region columns to the right. Someone tapping the label
                (exactly where the arrow pointed) got nothing. The label
                can't be a single link anyway: each region points at a
                different entity's records. */}
            <td className={cn("py-2.5", row.strong && "font-medium")}>{row.label}</td>
            {regions.map((r) => {
              const v = r[row.key];
              const valueClass = cn(
                "tabular-nums",
                row.strong && "font-medium",
                row.signed ? (v.gte(0) ? "text-success" : "text-destructive") : toneClass(row.tone)
              );
              const href = row.recordsHref && showOpsLinks ? row.recordsHref(entitySlug(r.entityCode)) : null;
              return (
                <td key={r.entityCode} className="py-2.5 text-right">
                  {/* Each region in its OWN currency — converting here would
                      hide which book the figure came from. The chevron sits
                      on the cell that's actually clickable, not on the row
                      label, so the hint and the target are the same element. */}
                  {href ? (
                    <Link
                      href={href}
                      className={cn(valueClass, "group/cell inline-flex items-center gap-1 transition-ui hover:underline")}
                    >
                      {formatMoney(v, r.currency)}
                      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50 transition-transform group-hover/cell:translate-x-0.5" />
                    </Link>
                  ) : (
                    <span className={valueClass}>{formatMoney(v, r.currency)}</span>
                  )}
                </td>
              );
            })}
            {/* The Total column stays plain text: it spans both currencies,
                so there is no single entity's record list it could open —
                same reasoning the Combined dashboard tiles use. */}
            <td
              className={cn(
                "py-2.5 text-right tabular-nums",
                row.strong && "font-semibold",
                total.available &&
                  (row.signed
                    ? total[row.key].gte(0)
                      ? "text-success"
                      : "text-destructive"
                    : toneClass(row.tone))
              )}
            >
              {total.available ? formatMoney(total[row.key], currency) : "—"}
            </td>
          </tr>
        ))}

        {footer && footerLabel && (
          <tr className="border-t border-border">
            <td className="py-2.5 font-medium">{footerLabel}</td>
            {footer.map((f, i) => (
              <td key={regions[i]?.entityCode ?? i} className="py-2.5 text-right tabular-nums text-muted-foreground">
                {f}
              </td>
            ))}
            <td className="py-2.5 text-right font-semibold tabular-nums">{footerTotal ?? "—"}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function toneClass(tone?: "success" | "destructive"): string {
  if (tone === "success") return "text-success";
  if (tone === "destructive") return "text-destructive";
  return "";
}
