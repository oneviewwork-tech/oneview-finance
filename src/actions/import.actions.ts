"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { actionError, actionSuccess, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { previewImportSchema, commitImportSchema, rollbackImportSchema } from "@/validators/import";
import { commitImport, previewImport, rollbackImportBatch, type CommitImportResult } from "@/services/import/import.service";
import {
  fromClientInflowRow,
  fromClientOutflowRow,
  toClientInflowRow,
  toClientOutflowRow,
  type ClientImportPreview,
  type ClientInflowRow,
  type ClientOutflowRow,
} from "@/domain/import/client-shapes";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function previewImportAction(formData: FormData): Promise<ActionResult<ClientImportPreview>> {
  const parsed = previewImportSchema.safeParse({
    entityId: formData.get("entityId"),
    periodYear: formData.get("periodYear"),
    periodMonth: formData.get("periodMonth"),
  });
  if (!parsed.success) return actionError("Invalid input", zodFieldErrors(parsed.error));

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return actionError("Choose a workbook file to upload", { file: ["Choose a workbook file to upload"] });
  }
  if (file.size > MAX_FILE_BYTES) {
    return actionError("File is too large (max 10MB)", { file: ["File is too large (max 10MB)"] });
  }

  const entity = await prisma.businessEntity.findUnique({ where: { id: parsed.data.entityId } });
  if (!entity) return actionError("Entity not found");

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return actionError("Could not read the uploaded file");
  }

  try {
    const preview = await previewImport(buffer, parsed.data.entityId, parsed.data.periodYear, parsed.data.periodMonth);
    return actionSuccess({
      entityId: preview.entityId,
      outflow: {
        validRows: preview.outflow.validRows.map(toClientOutflowRow),
        duplicateRowNumbers: preview.outflow.duplicateRowNumbers,
        errors: preview.outflow.errors,
        skippedCount: preview.outflow.skippedCount,
      },
      inflow: {
        validRows: preview.inflow.validRows.map(toClientInflowRow),
        duplicateRowNumbers: preview.inflow.duplicateRowNumbers,
        errors: preview.inflow.errors,
        skippedCount: preview.inflow.skippedCount,
      },
    });
  } catch (err) {
    return actionError(err instanceof Error ? err.message : "Could not parse this workbook");
  }
}

export async function commitImportAction(formData: FormData): Promise<ActionResult<CommitImportResult>> {
  const parsed = commitImportSchema.safeParse({
    entityId: formData.get("entityId"),
    originalCurrency: formData.get("originalCurrency"),
    sourceFileName: formData.get("sourceFileName"),
    outflowRowsJson: formData.get("outflowRowsJson"),
    inflowRowsJson: formData.get("inflowRowsJson"),
  });
  if (!parsed.success) return actionError("Invalid input", zodFieldErrors(parsed.error));

  let outflowRows: ClientOutflowRow[];
  let inflowRows: ClientInflowRow[];
  try {
    outflowRows = JSON.parse(parsed.data.outflowRowsJson);
    inflowRows = JSON.parse(parsed.data.inflowRowsJson);
  } catch {
    return actionError("Could not read the rows to import — please re-run the preview");
  }

  if (outflowRows.length === 0 && inflowRows.length === 0) {
    return actionError("Nothing selected to import");
  }

  const actor = await getCurrentUser();
  const result = await commitImport({
    entityId: parsed.data.entityId,
    originalCurrency: parsed.data.originalCurrency,
    outflowRows: outflowRows.map(fromClientOutflowRow),
    inflowRows: inflowRows.map(fromClientInflowRow),
    sourceFileName: parsed.data.sourceFileName,
    actorId: actor.id,
    actorEmail: actor.email,
  });

  revalidatePath("/operations", "layout");
  return actionSuccess(result);
}

export async function rollbackImportAction(formData: FormData): Promise<ActionResult<{ deletedCount: number }>> {
  const parsed = rollbackImportSchema.safeParse({ batchId: formData.get("batchId") });
  if (!parsed.success) return actionError("Invalid input", zodFieldErrors(parsed.error));

  const actor = await getCurrentUser();
  const result = await rollbackImportBatch(parsed.data.batchId, actor.id, actor.email);
  revalidatePath("/operations", "layout");
  return actionSuccess(result);
}
