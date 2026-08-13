"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Client, ClientType, Currency, Department, PaymentMethod } from "@prisma/client";
import { createInflow } from "@/actions/transaction.actions";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-destructive">{messages[0]}</p>;
}

export function InflowForm({
  entityCode,
  entityId,
  currency,
  clients,
  clientTypes,
  paymentMethods,
  departments,
}: {
  entityCode: string;
  entityId: string;
  currency: Currency;
  clients: Client[];
  clientTypes: ClientType[];
  paymentMethods: PaymentMethod[];
  departments: Department[];
}) {
  const router = useRouter();
  const [useNewClient, setUseNewClient] = useState(clients.length === 0);
  // Value and tax are held in state only so the total can be shown as it's
  // typed — the server recomputes the gross itself and never trusts this.
  const [value, setValue] = useState("");
  const [taxPct, setTaxPct] = useState("");
  const parseAmount = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const netValue = parseAmount(value);
  const pct = parseAmount(taxPct);
  // Rounded to the currency's two places here so the figure shown is exactly
  // the figure submitted — a displayed 52.50 that posted 52.4999 would put
  // the stored total a paisa off what the user was told.
  const taxAmount = Math.round(netValue * (pct / 100) * 100) / 100;
  const gross = netValue + taxAmount;
  const taxLabel = netValue > 0 && pct > 0 ? taxAmount.toFixed(2) : "—";
  const grossLabel = gross > 0 ? gross.toFixed(2) : "—";
  // A hint, not a default: rates change and neither entity should have one
  // silently applied to a deal it doesn't belong on.
  const rateHint = currency === "AED" ? "UAE VAT is usually 5%" : "GST is commonly 18%";

  const [state, formAction, pending] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    async (_prev, formData) => createInflow(formData),
    null
  );

  useEffect(() => {
    if (state?.success) {
      router.push(`/operations/transactions/${state.data.id}`);
    }
  }, [state, router]);

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="mt-6 space-y-5">
      <input type="hidden" name="entityId" value={entityId} />

      {state && !state.success && !fieldErrors && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="transactionDate">Date Received</Label>
          <Input type="date" id="transactionDate" name="transactionDate" required className="mt-1" />
          <FieldError messages={fieldErrors?.transactionDate} />
        </div>
        <div>
          <Label htmlFor="dealValue">Value ({currency})</Label>
          <Input
            inputMode="decimal"
            id="dealValue"
            name="dealValue"
            placeholder="0.00"
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1"
          />
          <p className="mt-1 text-metadata">Before tax.</p>
          <FieldError messages={fieldErrors?.dealValue} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="taxPct">Tax %</Label>
          <Input
            inputMode="decimal"
            id="taxPct"
            placeholder="0"
            value={taxPct}
            onChange={(e) => setTaxPct(e.target.value)}
            className="mt-1"
          />
          <p className="mt-1 text-metadata">{rateHint}. Leave blank if none.</p>
        </div>
        <div>
          {/* Computed from the percentage, but posted as an amount: the
              stored figure is money, and a rate would have to be re-applied
              (and could drift) every time the row was read. */}
          <Label>Tax ({currency})</Label>
          <div className="mt-1 flex h-10 items-center justify-end rounded-lg border border-border bg-muted px-3 text-sm tabular-nums">
            {taxLabel}
          </div>
          <input type="hidden" name="taxAmount" value={taxAmount > 0 ? taxAmount.toFixed(2) : ""} />
          <p className="mt-1 text-metadata">Collected for the government.</p>
          <FieldError messages={fieldErrors?.taxAmount} />
        </div>
        <div>
          <Label>Value + Tax ({currency})</Label>
          <div className="mt-1 flex h-10 items-center justify-end rounded-lg border border-border bg-muted px-3 text-sm font-medium tabular-nums">
            {grossLabel}
          </div>
          <p className="mt-1 text-metadata">Invoiced to the client.</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label>Client</Label>
          {clients.length > 0 && (
            <button
              type="button"
              onClick={() => setUseNewClient((v) => !v)}
              className="text-xs text-brand hover:underline"
            >
              {useNewClient ? "Choose an existing client instead" : "+ New client"}
            </button>
          )}
        </div>
        {!useNewClient ? (
          <>
            <Select name="clientId" required={!useNewClient} className="mt-1">
              <option value="">Select a client…</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
            <FieldError messages={fieldErrors?.clientId} />
          </>
        ) : (
          <div className="mt-1 grid grid-cols-2 gap-4">
            <Input name="newClientName" placeholder="New client name" required={useNewClient} />
            <Select name="newClientTypeId" defaultValue="">
              <option value="">Client type…</option>
              {clientTypes.map((ct) => (
                <option key={ct.id} value={ct.id}>
                  {ct.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className={departments.length > 0 ? "grid grid-cols-2 gap-4" : undefined}>
        <div>
          <Label htmlFor="description">Service / Project</Label>
          <Input id="description" name="description" placeholder="e.g. SMM Retainer, 6 months" required className="mt-1" />
          <FieldError messages={fieldErrors?.description} />
        </div>
        {/* The team delivering the work — this is what lets a department show
            revenue earned, not just costs incurred. */}
        {departments.length > 0 && (
          <div>
            <Label htmlFor="departmentId">Department (optional)</Label>
            <Select id="departmentId" name="departmentId" defaultValue="" className="mt-1">
              <option value="">-</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <FieldError messages={fieldErrors?.departmentId} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="amountReceived">Amount Received now ({currency})</Label>
          <Input inputMode="decimal" id="amountReceived" name="amountReceived" placeholder="Leave blank if none yet" className="mt-1" />
          <FieldError messages={fieldErrors?.amountReceived} />
        </div>
        <div>
          <Label htmlFor="paymentMethodId">Payment Mode</Label>
          <Select id="paymentMethodId" name="paymentMethodId" defaultValue="" className="mt-1">
            <option value="">-</option>
            {paymentMethods.map((pm) => (
              <option key={pm.id} value={pm.id}>
                {pm.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="referenceNumber">Reference No.</Label>
          <Input id="referenceNumber" name="referenceNumber" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="closedByName">Closed By (BD)</Label>
          <Input id="closedByName" name="closedByName" className="mt-1" />
        </div>
      </div>

      <div>
        <Label htmlFor="remarks">Remarks</Label>
        <Textarea id="remarks" name="remarks" className="mt-1" />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save inflow"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(`/operations/${entityCode}/inflow`)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
