import { Badge } from "./badge";
import type { TransactionStatus } from "@prisma/client";

// PENDING stays "destructive" (red), not "brand" — this app's design tokens
// reserve red specifically for overdue/risk financial states (see
// globals.css), and pending outflow/receivables are exactly that.
const STATUS_CONFIG: Record<TransactionStatus, { label: string; variant: "success" | "warning" | "destructive" }> = {
  PAID: { label: "Paid", variant: "success" },
  PARTIAL: { label: "Partial", variant: "warning" },
  PENDING: { label: "Pending", variant: "destructive" },
};

export function StatusBadge({ status }: { status: TransactionStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} dot>
      {config.label}
    </Badge>
  );
}
