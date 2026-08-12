"use client";

import Link from "next/link";
import type { Currency, TransactionStatus } from "@prisma/client";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export interface InflowRow {
  id: string;
  transactionDate: string; // ISO
  clientName: string;
  description: string;
  dealValue: number;
  received: number;
  collectedFraction: number;
  status: TransactionStatus;
  currency: Currency;
}

export function InflowTable({ rows, entityCode, entityName }: { rows: InflowRow[]; entityCode: string; entityName: string }) {
  const columns: DataTableColumn<InflowRow>[] = [
    {
      key: "date",
      header: "Date",
      sortValue: (r) => r.transactionDate,
      render: (r) => (
        <Link href={`/operations/transactions/${r.id}`} className="transition-ui hover:underline">
          {formatDate(new Date(r.transactionDate))}
        </Link>
      ),
    },
    { key: "client", header: "Client", sortValue: (r) => r.clientName, render: (r) => r.clientName },
    { key: "service", header: "Service / Project", render: (r) => <span className="text-muted-foreground">{r.description}</span> },
    {
      key: "dealValue",
      header: "Deal Value",
      align: "right",
      sortValue: (r) => r.dealValue,
      render: (r) => formatMoney(r.dealValue, r.currency),
    },
    {
      key: "received",
      header: "Received",
      align: "right",
      sortValue: (r) => r.received,
      render: (r) => formatMoney(r.received, r.currency),
    },
    {
      key: "pct",
      header: "% Collected",
      align: "right",
      sortValue: (r) => r.collectedFraction,
      render: (r) => formatPercent(r.collectedFraction),
    },
    { key: "status", header: "Status", sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.id}
      searchText={(r) => `${r.clientName} ${r.description}`}
      searchPlaceholder="Search client or project…"
      emptyState={
        <EmptyState
          title="No inflow recorded yet"
          description={`No inflow has been recorded for ${entityName}.`}
          actionLabel="Add inflow"
          actionHref={`/operations/${entityCode}/inflow/new`}
        />
      }
    />
  );
}
