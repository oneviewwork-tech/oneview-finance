"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ClientType } from "@prisma/client";
import { createClient } from "@/actions/client.actions";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function ClientForm({ entityId, clientTypes }: { entityId: string; clientTypes: ClientType[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    async (_prev, formData) => createClient(formData),
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
      <Button type="submit" size="sm" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Add client"}
      </Button>
    </form>
  );
}
