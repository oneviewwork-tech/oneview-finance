import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Plain link, not a fetch + blob dance: the endpoint already returns
 * Content-Disposition: attachment, so the browser downloads it natively and
 * the button keeps working without JavaScript.
 */
export function ExportButton({
  entityId,
  type,
  label = "Export CSV",
}: {
  entityId: string;
  type: "INFLOW" | "OUTFLOW";
  label?: string;
}) {
  // No range params — the endpoint reads that as "export the full history".
  const href = `/api/export/transactions?entityId=${encodeURIComponent(entityId)}&type=${type}`;

  return (
    <Link href={href} prefetch={false} download>
      <Button variant="outline" size="sm" className="gap-1.5">
        <Download className="h-3.5 w-3.5" />
        {label}
      </Button>
    </Link>
  );
}
