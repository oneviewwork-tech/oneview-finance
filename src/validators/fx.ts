import { z } from "zod";

export const setManualRateSchema = z.object({
  baseCurrency: z.enum(["AED", "INR"]),
  quoteCurrency: z.enum(["AED", "INR"]),
  rate: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,6})?$/, "Enter a valid rate (up to 6 decimal places)")
    .refine((v) => Number(v) > 0, "Rate must be greater than 0"),
  rateDate: z.string().trim().min(1, "Date is required"),
});
