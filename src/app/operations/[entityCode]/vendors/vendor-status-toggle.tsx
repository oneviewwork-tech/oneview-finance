"use client";

import { useTransition } from "react";
import type { VendorStatus } from "@prisma/client";
import { setVendorStatus } from "@/actions/vendor.actions";
import { Button } from "@/components/ui/button";

export function VendorStatusToggle({ id, status }: { id: string; status: VendorStatus }) {
  const [pending, startTransition] = useTransition();
  const next = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setVendorStatus(id, next);
        })
      }
    >
      {pending ? "…" : next === "INACTIVE" ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
