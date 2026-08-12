import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { ZohoFinanceWorkbookProvider } from "@/services/import/zoho-workbook-provider";

const REAL_WORKBOOK_PATH =
  "C:/Users/ASUS/OneDrive/Desktop/HACA WORK/ONEVIEW-FINANCE/Dubai_August_2026_Live_Finance_Tracker.xlsx";

describe("ZohoFinanceWorkbookProvider — against the real source workbook", () => {
  it("parses the exact row ranges confirmed in Phase 0 and finds every data row genuinely blank", async () => {
    const buffer = await readFile(REAL_WORKBOOK_PATH);
    const provider = new ZohoFinanceWorkbookProvider();
    const result = await provider.parse(buffer);

    expect(result.outflowRows).toHaveLength(140);
    expect(result.inflowRows).toHaveLength(80);

    // The real workbook is still an empty template — every pre-formatted
    // row should come back with no Expense Item / Client Name, proving the
    // parser reads real cells (not stale formula text) and stops exactly
    // at row 148/85, excluding the sheet's own TOTAL/EXAMPLE rows below that.
    expect(result.outflowRows.every((r) => r.expenseItem === null)).toBe(true);
    expect(result.inflowRows.every((r) => r.clientName === null)).toBe(true);
  });
});

describe("ZohoFinanceWorkbookProvider — against a synthetic populated workbook", () => {
  async function buildWorkbook(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const pt = wb.addWorksheet("Payment Tracker");
    // Header at row 8 (cols A-O per the real layout); data starts row 9.
    // NOTE: exceljs's `row.values = [...]` setter treats a dense array (one
    // with a real, non-hole element at index 0) as 0-indexed-to-column-1 —
    // no leading placeholder. A literal `[undefined, ...]` is NOT a sparse
    // array (index 0 is an explicit element, not a hole), so it shifts
    // everything by one column instead of skipping column A as intended.
    pt.getRow(8).values = [
      "#",
      "Week",
      "Expense Item",
      "Category",
      "Type",
      "Amount Due (AED)",
      "Amount Paid (AED)",
      "Pay Full?",
      "Paid (AED)",
      "Balance (AED)",
      "Status",
      "Date Paid",
      "Mode",
      "Reference No.",
      "Remarks",
    ];
    pt.getRow(9).values = [1, "WEEK 1", "Base Salary — Staff", "Salaries & Allowances", "Current Month", 27840, null, "Y"];
    pt.getRow(10).values = [2, "WEEK 2", "Office Rent", "Rent & Utilities", "Current Month", 15000, 10000, "N"];

    const inflow = wb.addWorksheet("Inflow Tracker");
    inflow.getRow(5).values = [
      "#",
      "Date Received",
      "Client Name",
      "Service / Project",
      "Client Type",
      "Deal Value (AED)",
      "Amount Received (AED)",
      "Balance Due (AED)",
      "% Collected",
      "Payment Mode",
      "Reference No.",
      "Closed By (BD)",
      "Month",
      "Remarks",
    ];
    inflow.getRow(6).values = [
      1,
      new Date(Date.UTC(2026, 7, 5)),
      "Gulf Retail LLC",
      "SMM Retainer — 6 months",
      "New Client",
      30000,
      15000,
      null,
      null,
      "Bank Transfer",
      "REF-1",
      "Aswin KP",
    ];

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  it("parses populated rows into the exact raw shape validation expects", async () => {
    const buffer = await buildWorkbook();
    const provider = new ZohoFinanceWorkbookProvider();
    const result = await provider.parse(buffer);

    const salaryRow = result.outflowRows.find((r) => r.rowNumber === 9)!;
    expect(salaryRow.expenseItem).toBe("Base Salary — Staff");
    expect(salaryRow.category).toBe("Salaries & Allowances");
    expect(salaryRow.amountDue).toBe(27840);
    expect(salaryRow.payFull).toBe("Y");

    const rentRow = result.outflowRows.find((r) => r.rowNumber === 10)!;
    expect(rentRow.amountDue).toBe(15000);
    expect(rentRow.amountPaid).toBe(10000);

    const blankRow = result.outflowRows.find((r) => r.rowNumber === 11)!;
    expect(blankRow.expenseItem).toBeNull();

    const inflowRow = result.inflowRows.find((r) => r.rowNumber === 6)!;
    expect(inflowRow.clientName).toBe("Gulf Retail LLC");
    expect(inflowRow.dealValue).toBe(30000);
    expect(inflowRow.dateReceived).toBeInstanceOf(Date);
  });
});
