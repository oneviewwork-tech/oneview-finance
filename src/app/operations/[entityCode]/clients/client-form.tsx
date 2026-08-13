"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { ClientType } from "@prisma/client";
import { createClient } from "@/actions/client.actions";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-destructive">{messages[0]}</p>;
}

export function ClientForm({
  entityId,
  clientTypes,
  currency,
}: {
  entityId: string;
  clientTypes: ClientType[];
  currency: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  // Held in state only so the tax and total can be shown as they are typed;
  // the server recomputes the gross itself and never trusts these.
  const [value, setValue] = useState("");
  const [taxPct, setTaxPct] = useState("");
  const amount = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const netValue = amount(value);
  // Rounded to the currency's two places so the figure shown is the figure
  // submitted.
  const taxAmount = Math.round(netValue * (amount(taxPct) / 100) * 100) / 100;
  const gross = netValue + taxAmount;
  const [state, formAction, pending] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    async (_prev, formData) => {
      const result = await createClient(formData);
      // Cleared here rather than in an effect: form.reset() doesn't touch
      // controlled inputs, and resetting state from an effect triggers a
      // cascading render.
      if (result.success) {
        setValue("");
        setTaxPct("");
      }
      return result;
    },
    null
  );

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;

  return (
    <form ref={formRef} action={formAction} className="mt-3 space-y-3 rounded-xl border border-border p-4">
      <input type="hidden" name="entityId" value={entityId} />
      {state && !state.success && !fieldErrors && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{state.error}</p>
      )}
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required className="mt-1" />
        {fieldErrors?.name && <p className="mt-1 text-xs text-destructive">{fieldErrors.name[0]}</p>}
      </div>
      <div>
        <Label htmlFor="clientTypeId">Client type</Label>
        <Select id="clientTypeId" name="clientTypeId" defaultValue="" className="mt-1">
          <option value="">-</option>
          {clientTypes.map((ct) => (
            <option key={ct.id} value={ct.id}>
              {ct.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="contactEmail">Email</Label>
        <Input id="contactEmail" name="contactEmail" type="email" className="mt-1" />
      </div>
      <div>
        <Label htmlFor="contactPhone">Phone</Label>
        <Input id="contactPhone" name="contactPhone" className="mt-1" />
      </div>

      {/* The client's opening deal. Optional — a client can be added before
          any work is agreed — but capturing it here saves adding the client,
          leaving, and coming back to book the deal you just signed. */}
      <div className="space-y-3 rounded-lg border border-border-subtle bg-secondary/30 p-3">
        <p className="text-card-title">Opening deal (optional)</p>

        <div>
          <Label htmlFor="dealDate">Date</Label>
          <Input type="date" id="dealDate" name="dealDate" className="mt-1" />
          <FieldError messages={fieldErrors?.dealDate} />
        </div>

        <div>
          <Label htmlFor="serviceProject">Service / Project</Label>
          <Input id="serviceProject" name="serviceProject" placeholder="e.g. SMM Retainer" className="mt-1" />
        </div>

        <div>
          <Label htmlFor="dealValue">Value ({currency})</Label>
          <Input
            inputMode="decimal"
            id="dealValue"
            name="dealValue"
            placeholder="0.00"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1"
          />
          <FieldError messages={fieldErrors?.dealValue} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="clientTaxPct">Tax %</Label>
            <Input
              inputMode="decimal"
              id="clientTaxPct"
              placeholder="0"
              value={taxPct}
              onChange={(e) => setTaxPct(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Tax ({currency})</Label>
            <div className="mt-1 flex h-10 items-center justify-end rounded-lg border border-border bg-muted px-3 text-sm tabular-nums">
              {taxAmount > 0 ? taxAmount.toFixed(2) : "—"}
            </div>
            {/* Posted as money, not a rate: a stored rate would have to be
                re-applied on every read and could drift from the invoice. */}
            <input type="hidden" name="taxAmount" value={taxAmount > 0 ? taxAmount.toFixed(2) : ""} />
          </div>
        </div>

        <div>
          <Label>Value + Tax ({currency})</Label>
          <div className="mt-1 flex h-10 items-center justify-end rounded-lg border border-border bg-muted px-3 text-sm font-medium tabular-nums">
            {gross > 0 ? gross.toFixed(2) : "—"}
          </div>
          <p className="mt-1 text-metadata">Booked as an unpaid inflow row for this client.</p>
        </div>
      </div>

      <Button type="submit" size="sm" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Add client"}
      </Button>
    </form>
  );
}
