"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Currency, Department, ExpenseType, FinancialCategory, PaymentMethod, Vendor } from "@prisma/client";
import { createOutflow } from "@/actions/transaction.actions";
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

export function OutflowForm({
  entityCode,
  entityId,
  currency,
  categories,
  expenseTypes,
  vendors,
  departments,
  paymentMethods,
}: {
  entityCode: string;
  entityId: string;
  currency: Currency;
  categories: FinancialCategory[];
  expenseTypes: ExpenseType[];
  vendors: Vendor[];
  departments: Department[];
  paymentMethods: PaymentMethod[];
}) {
  const router = useRouter();
  const [payFull, setPayFull] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    async (_prev, formData) => createOutflow(formData),
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
      <input type="hidden" name="payFull" value={payFull ? "Y" : "N"} />

      {state && !state.success && !fieldErrors && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="transactionDate">Date</Label>
          <Input type="date" id="transactionDate" name="transactionDate" required className="mt-1" />
          <FieldError messages={fieldErrors?.transactionDate} />
        </div>
        <div>
          <Label htmlFor="amountDue">Amount Due ({currency})</Label>
          <Input inputMode="decimal" id="amountDue" name="amountDue" placeholder="0.00" required className="mt-1" />
          <FieldError messages={fieldErrors?.amountDue} />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Expense Item</Label>
        <Input id="description" name="description" placeholder="e.g. Base Salary, Staff" required className="mt-1" />
        <FieldError messages={fieldErrors?.description} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="categoryId">Category</Label>
          <Select id="categoryId" name="categoryId" required defaultValue="" className="mt-1">
            <option value="" disabled>
              Select category…
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <FieldError messages={fieldErrors?.categoryId} />
        </div>
        <div>
          <Label htmlFor="expenseTypeId">Type</Label>
          <Select id="expenseTypeId" name="expenseTypeId" required defaultValue="" className="mt-1">
            <option value="" disabled>
              Select type…
            </option>
            {expenseTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <FieldError messages={fieldErrors?.expenseTypeId} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {vendors.length > 0 && (
          <div>
            <Label htmlFor="vendorId">Vendor (optional)</Label>
            <Select id="vendorId" name="vendorId" defaultValue="" className="mt-1">
              <option value="">-</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </div>
        )}
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
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border p-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={payFull}
            onChange={(e) => setPayFull(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          Pay in full now
        </label>

        {!payFull && (
          <div className="mt-3">
            <Label htmlFor="amountPaid">Amount Paid now ({currency}), leave blank if not paid yet</Label>
            <Input inputMode="decimal" id="amountPaid" name="amountPaid" placeholder="0.00" className="mt-1" />
            <FieldError messages={fieldErrors?.amountPaid} />
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="paymentDate">Date Paid</Label>
            <Input type="date" id="paymentDate" name="paymentDate" className="mt-1" />
          </div>
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
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="referenceNumber">Reference No.</Label>
          <Input id="referenceNumber" name="referenceNumber" className="mt-1" />
        </div>
      </div>

      <div>
        <Label htmlFor="remarks">Remarks</Label>
        <Textarea id="remarks" name="remarks" className="mt-1" />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save expense"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(`/operations/${entityCode}/outflow`)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
