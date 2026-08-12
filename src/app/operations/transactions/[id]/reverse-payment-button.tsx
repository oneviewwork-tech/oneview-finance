"use client";

import { useActionState } from "react";
import { reversePayment } from "@/actions/transaction.actions";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";

export function ReversePaymentButton({ paymentId }: { paymentId: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, formData) => reversePayment(formData),
    null
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("Reverse this payment? This removes it from the balance and recalculates the status.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="paymentId" value={paymentId} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending} className="text-destructive">
        {pending ? "Reversing…" : "Reverse"}
      </Button>
      {state && !state.success && <p className="mt-1 text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
