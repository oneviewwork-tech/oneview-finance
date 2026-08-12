"use client";

import { useActionState, useEffect, useRef } from "react";
import { setManualExchangeRate } from "@/actions/fx.actions";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function ManualRateForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, formData) => setManualExchangeRate(formData),
    null
  );

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      {state && !state.success && !fieldErrors && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="baseCurrency">From</Label>
          <Select id="baseCurrency" name="baseCurrency" defaultValue="AED" className="mt-1">
            <option value="AED">AED</option>
            <option value="INR">INR</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="quoteCurrency">To</Label>
          <Select id="quoteCurrency" name="quoteCurrency" defaultValue="INR" className="mt-1">
            <option value="INR">INR</option>
            <option value="AED">AED</option>
          </Select>
          {fieldErrors?.quoteCurrency && <p className="mt-1 text-xs text-destructive">{fieldErrors.quoteCurrency[0]}</p>}
        </div>
        <div>
          <Label htmlFor="rate">Rate</Label>
          <Input id="rate" name="rate" inputMode="decimal" placeholder="23.400000" required className="mt-1" />
          {fieldErrors?.rate && <p className="mt-1 text-xs text-destructive">{fieldErrors.rate[0]}</p>}
        </div>
      </div>
      <div>
        <Label htmlFor="rateDate">Effective date</Label>
        <Input type="date" id="rateDate" name="rateDate" required className="mt-1 max-w-48" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save rate"}
      </Button>
    </form>
  );
}
