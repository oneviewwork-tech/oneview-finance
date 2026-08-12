"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEntityWrite } from "@/lib/rbac";
import { actionError, actionSuccess, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { previewImportSchema, commitImportSchema, rollbackImportSchema } from "@/validators/import";
import {
  commitImport,
  previewImport,
  rollbackImportBatch,
  getImportBatchEntityCodes,
  type CommitImportResult,
} from "@/services/import/import.service";
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
  await requireEntityWrite(entity.code);

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

  const entity = await prisma.businessEntity.findUnique({ where: { id: parsed.data.entityId } });
  if (!entity) return actionError("Entity not found");
  const actor = await requireEntityWrite(entity.code);

  // Currency comes from the entity, never from the submitted form. The two
  // workbooks are structurally identical and differ only in currency, so a
  // stale or tampered field here would write (say) India's INR rows tagged
  // AED — which the combined dashboard would then convert as if they were
  // AED, inflating India's contribution ~23x. The entity's base currency is
  // the only authoritative source.
  if (parsed.data.originalCurrency !== entity.baseCurrency) {
    return actionError(
      `This workbook is being imported into ${entity.name}, whose currency is ${entity.baseCurrency}. Re-run the preview and try again.`
    );
  }

  const result = await commitImport({
    entityId: parsed.data.entityId,
    originalCurrency: entity.baseCurrency,
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

  const entityCodes = await getImportBatchEntityCodes(parsed.data.batchId);
  if (entityCodes.length === 0) return actionError("Import batch not found");

  let actor: Awaited<ReturnType<typeof requireEntityWrite>> | undefined;
  for (const code of entityCodes) {
    actor = await requireEntityWrite(code);
  }

  const result = await rollbackImportBatch(parsed.data.batchId, actor!.id, actor!.email);
  revalidatePath("/operations", "layout");
  return actionSuccess(result);
}
