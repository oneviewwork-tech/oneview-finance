import type { RawInflowRow, RawOutflowRow } from "@/domain/import/types";

export interface ParsedWorkbook {
  outflowRows: RawOutflowRow[];
  inflowRows: RawInflowRow[];
}

/**
 * Isolates the rest of the app from "what a source spreadsheet looks like"
 * — the spec is explicit that Zoho Sheets must stay a swappable/legacy
 * source, never baked into the domain model. A future source (a different
 * export format, a direct Zoho API pull) only needs a new implementation
 * of this interface.
 */
export interface FinancialImportProvider {
  parse(buffer: Buffer): Promise<ParsedWorkbook>;
}
