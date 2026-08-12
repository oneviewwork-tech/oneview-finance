"use client";

import { useActionState, useEffect, useRef } from "react";
import type { Currency, PaymentMethod } from "@prisma/client";
import { recordPayment } from "@/actions/transaction.actions";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function RecordPaymentForm({
  transactionId,
  currency,
  paymentMethods,
}: {
  transactionId: string;
  currency: Currency;
  paymentMethods: PaymentMethod[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, formData) => recordPayment(formData),
    null
  );

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="transactionId" value={transactionId} />
      {state && !state.success && !fieldErrors && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="amount">Amount ({currency})</Label>
          <Input inputMode="decimal" id="amount" name="amount" required className="mt-1" />
          {fieldErrors?.amount && <p className="mt-1 text-xs text-destructive">{fieldErrors.amount[0]}</p>}
        </div>
        <div>
          <Label htmlFor="paymentDate">Date</Label>
          <Input type="date" id="paymentDate" name="paymentDate" required className="mt-1" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="paymentMethodId">Mode</Label>
          <Select id="paymentMethodId" name="paymentMethodId" defaultValue="" className="mt-1">
            <option value="">-</option>
            {paymentMethods.map((pm) => (
              <option key={pm.id} value={pm.id}>
                {pm.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="referenceNumber">Reference No.</Label>
          <Input id="referenceNumber" name="referenceNumber" className="mt-1" />
        </div>
      </div>
      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Recording…" : "Record payment"}
      </Button>
    </form>
  );
}
