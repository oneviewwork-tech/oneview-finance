"use client";

import { useActionState } from "react";
import { refreshLiveExchangeRate } from "@/actions/fx.actions";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";

export function RefreshRateButton() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async () => refreshLiveExchangeRate(),
    null
  );

  return (
    <form action={formAction}>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Fetching…" : "Refresh live rate now"}
      </Button>
      {state && !state.success && <p className="mt-2 text-xs text-destructive">{state.error}</p>}
      {state?.success && <p className="mt-2 text-xs text-success">Rate refreshed.</p>}
    </form>
  );
}
