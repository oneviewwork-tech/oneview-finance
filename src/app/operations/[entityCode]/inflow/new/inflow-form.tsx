"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Client, ClientType, Currency, PaymentMethod } from "@prisma/client";
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
}: {
  entityCode: string;
  entityId: string;
  currency: Currency;
  clients: Client[];
  clientTypes: ClientType[];
  paymentMethods: PaymentMethod[];
}) {
  const router = useRouter();
  const [useNewClient, setUseNewClient] = useState(clients.length === 0);
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
          <Label htmlFor="dealValue">Deal Value ({currency})</Label>
          <Input inputMode="decimal" id="dealValue" name="dealValue" placeholder="0.00" required className="mt-1" />
          <FieldError messages={fieldErrors?.dealValue} />
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

      <div>
        <Label htmlFor="description">Service / Project</Label>
        <Input id="description" name="description" placeholder="e.g. SMM Retainer, 6 months" required className="mt-1" />
        <FieldError messages={fieldErrors?.description} />
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
