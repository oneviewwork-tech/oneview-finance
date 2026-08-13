import ExcelJS from "exceljs";
import type { RawCellValue, RawInflowRow, RawOutflowRow } from "@/domain/import/types";
import type { FinancialImportProvider, ParsedWorkbook } from "./provider";

// Layout comes from the shared workbook-layout module so the importer and
// the exporter cannot drift apart — see the comment there. Rows past the
// data ranges are the sheet's own "TOTAL"/"EXAMPLE" rows, deliberately
// excluded: structurally out of range rather than content we sniff for.
import {
  OUTFLOW_SHEET,
  OUTFLOW_FIRST_ROW,
  OUTFLOW_LAST_ROW,
  OUTFLOW_COL,
  INFLOW_SHEET,
  INFLOW_FIRST_ROW,
  INFLOW_LAST_ROW,
  INFLOW_COL,
} from "@/domain/import/workbook-layout";

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
        week: cellValue(row, OUTFLOW_COL.week),
        expenseItem: cellValue(row, OUTFLOW_COL.expenseItem),
        category: cellValue(row, OUTFLOW_COL.category),
        type: cellValue(row, OUTFLOW_COL.type),
        amountDue: cellValue(row, OUTFLOW_COL.amountDue),
        amountPaid: cellValue(row, OUTFLOW_COL.amountPaid),
        payFull: cellValue(row, OUTFLOW_COL.payFull),
        datePaid: cellValue(row, OUTFLOW_COL.datePaid),
        mode: cellValue(row, OUTFLOW_COL.mode),
        referenceNo: cellValue(row, OUTFLOW_COL.referenceNo),
        remarks: cellValue(row, OUTFLOW_COL.remarks),
      });
    }

    const inflowRows: RawInflowRow[] = [];
    for (let r = INFLOW_FIRST_ROW; r <= INFLOW_LAST_ROW; r++) {
      const row = inflowSheet.getRow(r);
      inflowRows.push({
        rowNumber: r,
        dateReceived: cellValue(row, INFLOW_COL.dateReceived),
        clientName: cellValue(row, INFLOW_COL.clientName),
        serviceProject: cellValue(row, INFLOW_COL.serviceProject),
        clientType: cellValue(row, INFLOW_COL.clientType),
        dealValue: cellValue(row, INFLOW_COL.dealValue),
        amountReceived: cellValue(row, INFLOW_COL.amountReceived),
        paymentMode: cellValue(row, INFLOW_COL.paymentMode),
        referenceNo: cellValue(row, INFLOW_COL.referenceNo),
        closedBy: cellValue(row, INFLOW_COL.closedBy),
        remarks: cellValue(row, INFLOW_COL.remarks),
      });
    }

    return { outflowRows, inflowRows };
  }
}
