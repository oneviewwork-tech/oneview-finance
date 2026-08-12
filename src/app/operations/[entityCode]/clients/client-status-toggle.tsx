"use client";

import { useTransition } from "react";
import type { ClientStatus } from "@prisma/client";
import { setClientStatus } from "@/actions/client.actions";
import { Button } from "@/components/ui/button";

export function ClientStatusToggle({ id, status }: { id: string; status: ClientStatus }) {
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
          await setClientStatus(id, next);
        })
      }
    >
      {pending ? "…" : next === "INACTIVE" ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
