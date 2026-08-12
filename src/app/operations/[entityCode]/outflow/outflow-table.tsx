"use client";

import Link from "next/link";
import type { Currency, TransactionStatus } from "@prisma/client";
import { formatMoney } from "@/lib/format";
import { weekLabel } from "@/domain/finance/period";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export interface OutflowRow {
  id: string;
  transactionDate: string; // ISO
  description: string;
  categoryName: string;
  expenseTypeName: string;
  amountDue: number;
  paid: number;
  status: TransactionStatus;
  currency: Currency;
}

export function OutflowTable({ rows, entityCode, entityName }: { rows: OutflowRow[]; entityCode: string; entityName: string }) {
  const columns: DataTableColumn<OutflowRow>[] = [
    {
      key: "week",
      header: "Week",
      sortValue: (r) => r.transactionDate,
      render: (r) => <span className="text-muted-foreground">{weekLabel(new Date(r.transactionDate))}</span>,
    },
    {
      key: "item",
      header: "Expense Item",
      sortValue: (r) => r.description,
      render: (r) => (
        <Link href={`/operations/transactions/${r.id}`} className="transition-ui hover:underline">
          {r.description}
        </Link>
      ),
    },
    { key: "category", header: "Category", sortValue: (r) => r.categoryName, render: (r) => r.categoryName },
    { key: "type", header: "Type", render: (r) => <span className="text-muted-foreground">{r.expenseTypeName}</span> },
    {
      key: "due",
      header: "Amount Due",
      align: "right",
      sortValue: (r) => r.amountDue,
      render: (r) => formatMoney(r.amountDue, r.currency),
    },
    { key: "paid", header: "Paid", align: "right", sortValue: (r) => r.paid, render: (r) => formatMoney(r.paid, r.currency) },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      sortValue: (r) => r.amountDue - r.paid,
      render: (r) => formatMoney(r.amountDue - r.paid, r.currency),
    },
    { key: "status", header: "Status", sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.id}
      searchText={(r) => `${r.description} ${r.categoryName}`}
      searchPlaceholder="Search expense or category…"
      emptyState={
        <EmptyState
          title="No expenses recorded"
          description={`No expenses have been recorded for ${entityName}.`}
          actionLabel="Add expense"
          actionHref={`/operations/${entityCode}/outflow/new`}
        />
      }
    />
  );
}
