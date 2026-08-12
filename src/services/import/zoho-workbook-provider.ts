import ExcelJS from "exceljs";
import type { RawCellValue, RawInflowRow, RawOutflowRow } from "@/domain/import/types";
import type { FinancialImportProvider, ParsedWorkbook } from "./provider";

// Matches Dubai_August_2026_Live_Finance_Tracker.xlsx exactly, confirmed
// against the real source workbook during Phase 0: Payment Tracker header
// at row 8, 140 pre-formatted data rows (9-148); Inflow Tracker header at
// row 5, 80 pre-formatted data rows (6-85). Rows past these ranges are the
// sheet's own "TOTAL"/"EXAMPLE" rows, deliberately excluded — not content
// we sniff for, structurally out of range.
const OUTFLOW_SHEET = "Payment Tracker";
const OUTFLOW_FIRST_ROW = 9;
const OUTFLOW_LAST_ROW = 148;

const INFLOW_SHEET = "Inflow Tracker";
const INFLOW_FIRST_ROW = 6;
const INFLOW_LAST_ROW = 85;

function cellValue(row: ExcelJS.Row, col: number): RawCellValue {
  const value = row.getCell(col).value;
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "object") {
    if ("result" in value) {
      // Formula cell — use its cached result, not the formula text.
      const result = (value as { result?: unknown }).result;
      if (result instanceof Date) return result;
      if (typeof result === "string" || typeof result === "number") return result;
      return null;
    }
    if ("richText" in value) {
      const richText = (value as { richText: { text: string }[] }).richText;
      return richText.map((r) => r.text).join("");
    }
    if ("text" in value) return String((value as { text: unknown }).text);
  }
  return null;
}

export class ZohoFinanceWorkbookProvider implements FinancialImportProvider {
  async parse(buffer: Buffer): Promise<ParsedWorkbook> {
    const wb = new ExcelJS.Workbook();
    // exceljs's bundled types pin an older Buffer shape than the project's
    // @types/node — a structural type-drift issue between the two
    // packages, not a real incompatibility (a Node Buffer works fine here).
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);

    const outflowSheet = wb.getWorksheet(OUTFLOW_SHEET);
    const inflowSheet = wb.getWorksheet(INFLOW_SHEET);
    if (!outflowSheet || !inflowSheet) {
      throw new Error(
        `This doesn't look like a ONEVIEW Finance workbook — expected sheets named "${OUTFLOW_SHEET}" and "${INFLOW_SHEET}".`
      );
    }

    const outflowRows: RawOutflowRow[] = [];
    for (let r = OUTFLOW_FIRST_ROW; r <= OUTFLOW_LAST_ROW; r++) {
      const row = outflowSheet.getRow(r);
      outflowRows.push({
        rowNumber: r,
        week: cellValue(row, 2),
        expenseItem: cellValue(row, 3),
        category: cellValue(row, 4),
        type: cellValue(row, 5),
        amountDue: cellValue(row, 6),
        amountPaid: cellValue(row, 7),
        payFull: cellValue(row, 8),
        datePaid: cellValue(row, 12),
        mode: cellValue(row, 13),
        referenceNo: cellValue(row, 14),
        remarks: cellValue(row, 15),
      });
    }

    const inflowRows: RawInflowRow[] = [];
    for (let r = INFLOW_FIRST_ROW; r <= INFLOW_LAST_ROW; r++) {
      const row = inflowSheet.getRow(r);
      inflowRows.push({
        rowNumber: r,
        dateReceived: cellValue(row, 2),
        clientName: cellValue(row, 3),
        serviceProject: cellValue(row, 4),
        clientType: cellValue(row, 5),
        dealValue: cellValue(row, 6),
        amountReceived: cellValue(row, 7),
        paymentMode: cellValue(row, 10),
        referenceNo: cellValue(row, 11),
        closedBy: cellValue(row, 12),
        remarks: cellValue(row, 14),
      });
    }

    return { outflowRows, inflowRows };
  }
}
