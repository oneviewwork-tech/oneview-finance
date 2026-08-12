import { z } from "zod";

export const previewImportSchema = z.object({
  entityId: z.string().trim().min(1, "Select an entity"),
  periodYear: z.coerce.number().int().min(2000).max(2100),
  periodMonth: z.coerce.number().int().min(1).max(12),
});

export const commitImportSchema = z.object({
  entityId: z.string().trim().min(1),
  originalCurrency: z.enum(["AED", "INR"]),
  sourceFileName: z.string().trim().min(1),
  outflowRowsJson: z.string(),
  inflowRowsJson: z.string(),
});

export const rollbackImportSchema = z.object({
  batchId: z.string().trim().min(1),
});
