"use client";

import type { VendorStatus } from "@prisma/client";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { VendorStatusToggle } from "./vendor-status-toggle";

export interface VendorRow {
  id: string;
  name: string;
  country: string | null;
  status: VendorStatus;
}

export function VendorsTable({ rows }: { rows: VendorRow[] }) {
  const columns: DataTableColumn<VendorRow>[] = [
    { key: "name", header: "Name", sortValue: (r) => r.name, render: (r) => r.name },
    {
      key: "country",
      header: "Country",
      sortValue: (r) => r.country ?? "",
      render: (r) => <span className="text-muted-foreground">{r.country ?? "-"}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      render: (r) => <Badge variant={r.status === "ACTIVE" ? "success" : "neutral"} dot>{r.status}</Badge>,
    },
    { key: "actions", header: "", align: "right", render: (r) => <VendorStatusToggle id={r.id} status={r.status} /> },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.id}
      searchText={(r) => r.name}
      searchPlaceholder="Search vendors…"
      emptyState={<EmptyState title="No vendors yet" description="Vendors you add will appear here." />}
    />
  );
}
