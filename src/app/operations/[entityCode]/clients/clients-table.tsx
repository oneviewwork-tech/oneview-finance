"use client";

import type { ClientStatus } from "@prisma/client";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ClientStatusToggle } from "./client-status-toggle";

export interface ClientRow {
  id: string;
  name: string;
  clientTypeName: string | null;
  contact: string | null;
  status: ClientStatus;
}

export function ClientsTable({ rows }: { rows: ClientRow[] }) {
  const columns: DataTableColumn<ClientRow>[] = [
    { key: "name", header: "Name", sortValue: (r) => r.name, render: (r) => r.name },
    {
      key: "type",
      header: "Type",
      sortValue: (r) => r.clientTypeName ?? "",
      render: (r) => <span className="text-muted-foreground">{r.clientTypeName ?? "-"}</span>,
    },
    { key: "contact", header: "Contact", render: (r) => <span className="text-muted-foreground">{r.contact ?? "-"}</span> },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      render: (r) => <Badge variant={r.status === "ACTIVE" ? "success" : "neutral"} dot>{r.status}</Badge>,
    },
    { key: "actions", header: "", align: "right", render: (r) => <ClientStatusToggle id={r.id} status={r.status} /> },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.id}
      searchText={(r) => r.name}
      searchPlaceholder="Search clients…"
      emptyState={<EmptyState title="No clients yet" description="Clients you add will appear here." />}
    />
  );
}
