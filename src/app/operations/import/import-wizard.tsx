"use client";

import { useMemo, useState, useTransition } from "react";
import type { BusinessEntity } from "@prisma/client";
import { previewImportAction, commitImportAction, rollbackImportAction } from "@/actions/import.actions";
import type { ClientImportPreview } from "@/domain/import/client-shapes";
import type { CommitImportResult } from "@/services/import/import.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Step = "upload" | "preview" | "done";

export function ImportWizard({ entities }: { entities: BusinessEntity[] }) {
  const [step, setStep] = useState<Step>("upload");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [entityId, setEntityId] = useState(entities[0]?.id ?? "");
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
  const [periodMonth, setPeriodMonth] = useState(new Date().getMonth() + 1);
  const [sourceFileName, setSourceFileName] = useState("");

  const [preview, setPreview] = useState<ClientImportPreview | null>(null);
  const [excludedOutflow, setExcludedOutflow] = useState<Set<number>>(new Set());
  const [excludedInflow, setExcludedInflow] = useState<Set<number>>(new Set());
  const [commitResult, setCommitResult] = useState<CommitImportResult | null>(null);

  const selectedEntity = entities.find((e) => e.id === entityId);

  const outflowToImport = useMemo(
    () => preview?.outflow.validRows.filter((r) => !excludedOutflow.has(r.rowNumber)) ?? [],
    [preview, excludedOutflow]
  );
  const inflowToImport = useMemo(
    () => preview?.inflow.validRows.filter((r) => !excludedInflow.has(r.rowNumber)) ?? [],
    [preview, excludedInflow]
  );

  function handlePreviewSubmit(formData: FormData) {
    setError(null);
    const file = formData.get("file") as File;
    setSourceFileName(file?.name ?? "");
    startTransition(async () => {
      const result = await previewImportAction(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setPreview(result.data);
      // Pre-exclude anything flagged as a likely duplicate — the accountant opts in, not out.
      setExcludedOutflow(new Set(result.data.outflow.duplicateRowNumbers));
      setExcludedInflow(new Set(result.data.inflow.duplicateRowNumbers));
      setStep("preview");
    });
  }

  function handleConfirmImport() {
    if (!selectedEntity) return;
    setError(null);
    const formData = new FormData();
    formData.set("entityId", entityId);
    formData.set("originalCurrency", selectedEntity.baseCurrency);
    formData.set("sourceFileName", sourceFileName);
    formData.set("outflowRowsJson", JSON.stringify(outflowToImport));
    formData.set("inflowRowsJson", JSON.stringify(inflowToImport));
    startTransition(async () => {
      const result = await commitImportAction(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setCommitResult(result.data);
      setStep("done");
    });
  }

  function handleUndo() {
    if (!commitResult) return;
    const formData = new FormData();
    formData.set("batchId", commitResult.batchId);
    startTransition(async () => {
      const result = await rollbackImportAction(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setCommitResult(null);
      setPreview(null);
      setStep("upload");
    });
  }

  function toggleExclude(kind: "outflow" | "inflow", rowNumber: number) {
    const setFn = kind === "outflow" ? setExcludedOutflow : setExcludedInflow;
    setFn((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }

  if (step === "done" && commitResult) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Import complete</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">
            Imported <strong>{commitResult.outflowImported}</strong> outflow rows and{" "}
            <strong>{commitResult.inflowImported}</strong> inflow rows into {selectedEntity?.name}.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={handleUndo} disabled={pending}>
              {pending ? "Undoing…" : "Undo this import"}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setStep("upload");
                setPreview(null);
                setCommitResult(null);
              }}
            >
              Import another file
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "preview" && preview) {
    return (
      <div className="mt-6 space-y-6">
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <ImportSideSummary title="Payment Tracker (Outflow)" side={preview.outflow} kind="outflow" excluded={excludedOutflow} onToggle={toggleExclude} />
        <ImportSideSummary title="Inflow Tracker" side={preview.inflow} kind="inflow" excluded={excludedInflow} onToggle={toggleExclude} />

        <div className="flex gap-3">
          <Button onClick={handleConfirmImport} disabled={pending || (outflowToImport.length === 0 && inflowToImport.length === 0)}>
            {pending ? "Importing…" : `Confirm Import (${outflowToImport.length + inflowToImport.length} rows)`}
          </Button>
          <Button variant="outline" onClick={() => setStep("upload")} disabled={pending}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={handlePreviewSubmit} className="mt-6 space-y-5">
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <div>
        <Label htmlFor="entityId">Entity</Label>
        <Select id="entityId" name="entityId" value={entityId} onChange={(e) => setEntityId(e.target.value)} className="mt-1 max-w-xs">
          {entities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.baseCurrency})
            </option>
          ))}
        </Select>
      </div>

      <div className="grid max-w-xs grid-cols-2 gap-4">
        <div>
          <Label htmlFor="periodMonth">Which month does this file cover?</Label>
          <Select
            id="periodMonth"
            name="periodMonth"
            value={periodMonth}
            onChange={(e) => setPeriodMonth(Number(e.target.value))}
            className="mt-1"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="periodYear">Year</Label>
          <Input
            id="periodYear"
            name="periodYear"
            type="number"
            value={periodYear}
            onChange={(e) => setPeriodYear(Number(e.target.value))}
            className="mt-1"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        The Payment Tracker only records a Week (1-4), not a calendar date, so this tells the importer which month those
        weeks fall in. The Inflow Tracker already has real dates and ignores this.
      </p>

      <div>
        <Label htmlFor="file">Workbook file (.xlsx)</Label>
        <Input id="file" name="file" type="file" accept=".xlsx" required className="mt-1" />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Reading file…" : "Preview Import"}
      </Button>
    </form>
  );
}

function ImportSideSummary({
  title,
  side,
  kind,
  excluded,
  onToggle,
}: {
  title: string;
  side: ClientImportPreview["outflow"] | ClientImportPreview["inflow"];
  kind: "outflow" | "inflow";
  excluded: Set<number>;
  onToggle: (kind: "outflow" | "inflow", rowNumber: number) => void;
}) {
  const duplicateSet = new Set(side.duplicateRowNumbers);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3 text-sm">
          <Badge variant="success">{side.validRows.length - side.duplicateRowNumbers.length} new, valid</Badge>
          <Badge variant="warning">{side.duplicateRowNumbers.length} possible duplicates</Badge>
          <Badge variant="destructive">{side.errors.length} errors</Badge>
          <Badge variant="neutral">{side.skippedCount} blank rows skipped</Badge>
        </div>

        {side.duplicateRowNumbers.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Possible duplicates. Unchecked rows below will NOT be imported. Check a row to import it anyway.
            </p>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-2 text-sm">
              {side.validRows
                .filter((r) => duplicateSet.has(r.rowNumber))
                .map((r) => (
                  <li key={r.rowNumber} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!excluded.has(r.rowNumber)}
                      onChange={() => onToggle(kind, r.rowNumber)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="text-muted-foreground">Row {r.rowNumber}:</span>
                    <span>{kind === "outflow" ? (r as { description: string }).description : (r as { clientName: string }).clientName}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {side.errors.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Errors (these rows will not be imported):</p>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-sm">
              {side.errors.slice(0, 50).map((e, i) => (
                <li key={i} className="text-destructive">
                  Row {e.rowNumber}{e.field ? ` (${e.field})` : ""}: {e.message}
                </li>
              ))}
              {side.errors.length > 50 && <li className="text-muted-foreground">…and {side.errors.length - 50} more</li>}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
