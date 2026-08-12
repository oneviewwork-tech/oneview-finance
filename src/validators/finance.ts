import { z } from "zod";

/**
 * Amounts arrive from <form> submissions as strings. Validated as a decimal
 * string here (not coerced to `number`) so the action layer can hand the
 * exact string straight to `new Prisma.Decimal(...)` — coercing through a
 * JS `number` first is exactly the floating-point risk the spec forbids.
 */
export const moneyString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount (up to 2 decimal places)")
  .refine((v) => Number(v) > 0, "Amount must be greater than 0");

// FormData.get() returns `null` (not `undefined`) for a field that's
// simply absent from the DOM — e.g. the inflow form doesn't render a
// clientId <select> at all on the "new client" path. Every optional field
// schema has to tolerate null, "", and undefined identically, or a
// perfectly valid submission fails validation.
const blankToUndefined = (v: unknown) => (v === "" || v === null || v === undefined ? undefined : v);

export const optionalMoneyString = z.preprocess(
  blankToUndefined,
  z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount (up to 2 decimal places)").optional()
);

export const dateOnlyString = z.string().trim().min(1, "Date is required");

export const cuid = z.string().trim().min(1, "Required");
export const optionalCuid = z.preprocess(blankToUndefined, z.string().trim().optional());

export const entityCodeSchema = z.enum(["UAE", "INDIA"]);

// ── Master data (categories, expense types, payment methods, client types) ──

export const masterDataNameSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
});

// ── Clients & Vendors ─────────────────────────────────────────────────

export const clientSchema = z.object({
  entityId: cuid,
  name: z.string().trim().min(1, "Client name is required").max(200),
  clientTypeId: optionalCuid,
  country: z.string().trim().max(100).optional(),
  contactName: z.string().trim().max(200).optional(),
  contactEmail: z.string().trim().email().optional().or(z.literal("")),
  contactPhone: z.string().trim().max(50).optional(),
});

export const vendorSchema = z.object({
  entityId: cuid,
  name: z.string().trim().min(1, "Vendor name is required").max(200),
  country: z.string().trim().max(100).optional(),
});

// ── Inflow (client deal + receipt) ──────────────────────────────────

export const createInflowSchema = z.object({
  entityId: cuid,
  transactionDate: dateOnlyString,
  clientId: optionalCuid, // existing client
  newClientName: z.string().trim().max(200).optional(), // or create-on-the-fly
  newClientTypeId: optionalCuid,
  description: z.string().trim().min(1, "Service / Project is required").max(300),
  dealValue: moneyString,
  amountReceived: optionalMoneyString, // initial receipt, may be partial or omitted (PENDING)
  paymentMethodId: optionalCuid,
  referenceNumber: z.string().trim().max(120).optional(),
  closedByName: z.string().trim().max(200).optional(),
  remarks: z.string().trim().max(1000).optional(),
});

// ── Outflow (expense) ────────────────────────────────────────────────

export const createOutflowSchema = z.object({
  entityId: cuid,
  transactionDate: dateOnlyString,
  description: z.string().trim().min(1, "Expense item is required").max(300),
  categoryId: cuid,
  expenseTypeId: cuid,
  vendorId: optionalCuid,
  amountDue: moneyString,
  payFull: z.enum(["Y", "N"]).default("N"),
  amountPaid: optionalMoneyString, // used when payFull = N and a partial amount was paid now
  paymentDate: z.preprocess(blankToUndefined, z.string().trim().optional()), // "Date Paid" — defaults to transactionDate if a payment was made now
  paymentMethodId: optionalCuid,
  referenceNumber: z.string().trim().max(120).optional(),
  remarks: z.string().trim().max(1000).optional(),
});

// ── Recording a payment against an existing transaction ─────────────

export const recordPaymentSchema = z.object({
  transactionId: cuid,
  amount: moneyString,
  paymentDate: dateOnlyString,
  paymentMethodId: optionalCuid,
  referenceNumber: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const reversePaymentSchema = z.object({
  paymentId: cuid,
});
