import ExcelJS from "exceljs";
import type { Currency } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DateRange } from "@/domain/finance/date-range";
import { weekLabel } from "@/domain/finance/period";
import { monthLabel } from "@/domain/finance/period";
import {
  OUTFLOW_SHEET,
  OUTFLOW_HEADER_ROW,
  OUTFLOW_FIRST_ROW,
  OUTFLOW_COL,
  INFLOW_SHEET,
  INFLOW_HEADER_ROW,
  INFLOW_FIRST_ROW,
  INFLOW_COL,
  outflowHeaders,
  inflowHeaders,
} from "@/domain/import/workbook-layout";
import { getCategorySummary, getWeeklySummary, getDashboardOverview, getInflowSummary } from "@/services/finance/summary";

/**
 * Exports an entity's data in the same workbook shape the accounts team
 * already uses, so the file is familiar — and, more usefully, so it can be
 * edited and fed straight back through Import. The round-trip is covered by
 * a test; the layout constants are shared with the importer.
 *
 * Computed columns are written as real formulas rather than baked values, so
 * the sheet keeps recalculating when someone edits an amount — the behaviour
 * of the original workbook, not a dead snapshot of it.
 */

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F3A5F" },
};

const TITLE_FONT: Partial<ExcelJS.Font> = { bold: true, size: 14, color: { argb: "FF1F3A5F" } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };

/** Yellow = the accountant types here; grey = the sheet fills it in. */
const INPUT_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFDE7" } };
const COMPUTED_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F4F7" } };

function moneyFormat(currency: Currency): string {
  return currency === "INR" ? '#,##,##0.00' : '#,##0.00';
}

function styleHeaderRow(sheet: ExcelJS.Worksheet, rowNumber: number, headers: string[]) {
  const row = sheet.getRow(rowNumber);
  headers.forEach((h, i) => {
    const cell = row.getCell(i + 1);
    cell.value = h;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  });
  row.height = 28;
}

export async function exportWorkbook(entityId: string, range?: DateRange): Promise<Buffer> {
  const entity = await prisma.businessEntity.findUniqueOrThrow({ where: { id: entityId } });
  const currency = entity.baseCurrency;
  const money = moneyFormat(currency);

  const where = {
    entityId,
    ...(range ? { transactionDate: { gte: range.from, lte: range.to } } : {}),
  };

  const [outflow, inflow, categorySummary, weekly, overview, inflowSummary] = await Promise.all([
    prisma.financialTransaction.findMany({
      where: { ...where, transactionType: "OUTFLOW" },
      include: { category: true, expenseType: true, department: true, vendor: true, payments: { include: { paymentMethod: true } } },
      orderBy: { transactionDate: "asc" },
    }),
    prisma.financialTransaction.findMany({
      where: { ...where, transactionType: "INFLOW" },
      include: { client: { include: { clientType: true } }, payments: { include: { paymentMethod: true } } },
      orderBy: { transactionDate: "asc" },
    }),
    getCategorySummary(entityId, range),
    range ? getWeeklySummary(entityId, range) : null,
    getDashboardOverview(entityId, range),
    getInflowSummary(entityId, range),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "ONEVIEW Finance";
  wb.created = new Date();

  // ── Payment Tracker ──────────────────────────────────────────────
  const pt = wb.addWorksheet(OUTFLOW_SHEET, { views: [{ state: "frozen", ySplit: OUTFLOW_HEADER_ROW }] });
  pt.getCell("A1").value = `${entity.name.toUpperCase()} — PAYMENT TRACKER (${currency})`;
  pt.getCell("A1").font = TITLE_FONT;
  pt.getCell("A2").value =
    "ADD AN EXPENSE →  pick the Week, type the Expense Item, pick a Category and Type, then enter the Amount Due.";
  pt.getCell("A3").value =
    "MARK A PAYMENT →  Paid in full: type Y in 'Pay Full?'.  Paid part: type the amount in 'Amount Paid'.  Not paid: leave both blank.";
  pt.getCell("A4").value = "Status, Balance and the summary sheets update themselves. Yellow = you type · Grey = automatic.";
  [2, 3, 4].forEach((r) => (pt.getCell(`A${r}`).font = { size: 9, italic: true, color: { argb: "FF6B7280" } }));

  const ptLast = OUTFLOW_FIRST_ROW + Math.max(outflow.length, 1) - 1;
  pt.getCell("C6").value = "Total Due";
  pt.getCell("D6").value = { formula: `SUM(F${OUTFLOW_FIRST_ROW}:F${ptLast})` };
  pt.getCell("F6").value = "Paid";
  pt.getCell("G6").value = { formula: `SUM(I${OUTFLOW_FIRST_ROW}:I${ptLast})` };
  pt.getCell("I6").value = "Pending";
  pt.getCell("J6").value = { formula: `SUM(J${OUTFLOW_FIRST_ROW}:J${ptLast})` };
  [["C6"], ["F6"], ["I6"]].forEach(([c]) => (pt.getCell(c).font = { bold: true, size: 10 }));
  ["D6", "G6", "J6"].forEach((c) => {
    pt.getCell(c).numFmt = money;
    pt.getCell(c).font = { bold: true };
  });

  styleHeaderRow(pt, OUTFLOW_HEADER_ROW, outflowHeaders(currency));

  outflow.forEach((t, i) => {
    const r = OUTFLOW_FIRST_ROW + i;
    const row = pt.getRow(r);
    const firstPayment = t.payments[0];
    row.getCell(OUTFLOW_COL.index).value = { formula: `IF($C${r}="","",COUNTA($C$${OUTFLOW_FIRST_ROW}:$C${r}))` };
    row.getCell(OUTFLOW_COL.week).value = weekLabel(t.transactionDate);
    row.getCell(OUTFLOW_COL.expenseItem).value = t.description;
    row.getCell(OUTFLOW_COL.category).value = t.category?.name ?? "";
    row.getCell(OUTFLOW_COL.type).value = t.expenseType?.name ?? "";
    row.getCell(OUTFLOW_COL.amountDue).value = t.originalAmount.toNumber();
    row.getCell(OUTFLOW_COL.amountPaid).value = t.paidAmount.gt(0) ? t.paidAmount.toNumber() : null;
    row.getCell(OUTFLOW_COL.payFull).value = t.status === "PAID" ? "Y" : "";
    // Same formulas the source workbook uses, so edits recalculate.
    row.getCell(OUTFLOW_COL.paid).value = {
      formula: `IF($F${r}="","",IF(UPPER($H${r})="Y",$F${r},IF($G${r}="",0,$G${r})))`,
    };
    row.getCell(OUTFLOW_COL.balance).value = { formula: `IF($F${r}="","",$F${r}-$I${r})` };
    row.getCell(OUTFLOW_COL.status).value = {
      formula: `IF($F${r}="","",IF($I${r}<=0,"PENDING",IF($I${r}>=$F${r},"PAID","PARTIAL")))`,
    };
    row.getCell(OUTFLOW_COL.datePaid).value = firstPayment?.paymentDate ?? null;
    row.getCell(OUTFLOW_COL.mode).value = firstPayment?.paymentMethod?.name ?? "";
    row.getCell(OUTFLOW_COL.referenceNo).value = t.referenceNumber ?? "";
    row.getCell(OUTFLOW_COL.remarks).value = t.remarks ?? "";

    [OUTFLOW_COL.amountDue, OUTFLOW_COL.amountPaid, OUTFLOW_COL.paid, OUTFLOW_COL.balance].forEach((c) => {
      row.getCell(c).numFmt = money;
    });
    row.getCell(OUTFLOW_COL.datePaid).numFmt = "dd-mmm-yyyy";
    [OUTFLOW_COL.week, OUTFLOW_COL.expenseItem, OUTFLOW_COL.category, OUTFLOW_COL.type, OUTFLOW_COL.amountDue, OUTFLOW_COL.amountPaid, OUTFLOW_COL.payFull].forEach(
      (c) => (row.getCell(c).fill = INPUT_FILL)
    );
    [OUTFLOW_COL.index, OUTFLOW_COL.paid, OUTFLOW_COL.balance, OUTFLOW_COL.status].forEach(
      (c) => (row.getCell(c).fill = COMPUTED_FILL)
    );
  });

  pt.columns = [
    { width: 5 }, { width: 10 }, { width: 34 }, { width: 24 }, { width: 18 },
    { width: 16 }, { width: 16 }, { width: 10 }, { width: 16 }, { width: 16 },
    { width: 12 }, { width: 14 }, { width: 16 }, { width: 18 }, { width: 30 },
  ];
  pt.autoFilter = {
    from: { row: OUTFLOW_HEADER_ROW, column: 1 },
    to: { row: OUTFLOW_HEADER_ROW, column: 15 },
  };

  // ── Inflow Tracker ───────────────────────────────────────────────
  const it = wb.addWorksheet(INFLOW_SHEET, { views: [{ state: "frozen", ySplit: INFLOW_HEADER_ROW }] });
  it.getCell("A1").value = `${entity.name.toUpperCase()} — INFLOW TRACKER — CLIENTS CLOSED & PAYMENTS RECEIVED (${currency})`;
  it.getCell("A1").font = TITLE_FONT;
  it.getCell("A2").value = "Add one row per client. Type the amount actually received — part-payments are fine, Balance Due works it out.";
  it.getCell("A3").value = "Yellow = you type · Grey = automatic.";
  [2, 3].forEach((r) => (it.getCell(`A${r}`).font = { size: 9, italic: true, color: { argb: "FF6B7280" } }));

  styleHeaderRow(it, INFLOW_HEADER_ROW, inflowHeaders(currency));

  inflow.forEach((t, i) => {
    const r = INFLOW_FIRST_ROW + i;
    const row = it.getRow(r);
    const firstPayment = t.payments[0];
    row.getCell(INFLOW_COL.index).value = { formula: `IF($C${r}="","",COUNTA($C$${INFLOW_FIRST_ROW}:$C${r}))` };
    row.getCell(INFLOW_COL.dateReceived).value = t.transactionDate;
    row.getCell(INFLOW_COL.clientName).value = t.client?.name ?? "";
    row.getCell(INFLOW_COL.serviceProject).value = t.description;
    row.getCell(INFLOW_COL.clientType).value = t.client?.clientType?.name ?? "";
    row.getCell(INFLOW_COL.dealValue).value = t.originalAmount.toNumber();
    row.getCell(INFLOW_COL.amountReceived).value = t.paidAmount.toNumber();
    row.getCell(INFLOW_COL.balanceDue).value = {
      formula: `IF($C${r}="","",IF($F${r}="",0,$F${r})-IF($G${r}="",0,$G${r}))`,
    };
    row.getCell(INFLOW_COL.percentCollected).value = {
      formula: `IF($F${r}="","",IF($F${r}=0,0,IF($G${r}="",0,$G${r})/$F${r}))`,
    };
    row.getCell(INFLOW_COL.paymentMode).value = firstPayment?.paymentMethod?.name ?? "";
    row.getCell(INFLOW_COL.referenceNo).value = t.referenceNumber ?? "";
    row.getCell(INFLOW_COL.closedBy).value = t.closedByName ?? "";
    row.getCell(INFLOW_COL.month).value = monthLabel(t.transactionDate);
    row.getCell(INFLOW_COL.remarks).value = t.remarks ?? "";

    [INFLOW_COL.dealValue, INFLOW_COL.amountReceived, INFLOW_COL.balanceDue].forEach((c) => {
      row.getCell(c).numFmt = money;
    });
    row.getCell(INFLOW_COL.percentCollected).numFmt = "0.0%";
    row.getCell(INFLOW_COL.dateReceived).numFmt = "dd-mmm-yyyy";
    [INFLOW_COL.dateReceived, INFLOW_COL.clientName, INFLOW_COL.serviceProject, INFLOW_COL.clientType, INFLOW_COL.dealValue, INFLOW_COL.amountReceived].forEach(
      (c) => (row.getCell(c).fill = INPUT_FILL)
    );
    [INFLOW_COL.index, INFLOW_COL.balanceDue, INFLOW_COL.percentCollected, INFLOW_COL.month].forEach(
      (c) => (row.getCell(c).fill = COMPUTED_FILL)
    );
  });

  it.columns = [
    { width: 5 }, { width: 14 }, { width: 28 }, { width: 30 }, { width: 16 },
    { width: 16 }, { width: 18 }, { width: 16 }, { width: 12 }, { width: 16 },
    { width: 18 }, { width: 18 }, { width: 10 }, { width: 30 },
  ];
  it.autoFilter = {
    from: { row: INFLOW_HEADER_ROW, column: 1 },
    to: { row: INFLOW_HEADER_ROW, column: 14 },
  };

  // ── Category Summary ─────────────────────────────────────────────
  const cs = wb.addWorksheet("Category Summary");
  cs.getCell("A1").value = `${entity.name.toUpperCase()} — CATEGORY SUMMARY (${currency})`;
  cs.getCell("A1").font = TITLE_FONT;
  cs.getCell("A2").value = "Live from the Payment Tracker. Nothing to edit here.";
  cs.getCell("A2").font = { size: 9, italic: true, color: { argb: "FF6B7280" } };
  styleHeaderRow(cs, 4, ["Category", `Total Due (${currency})`, `Paid (${currency})`, `Pending (${currency})`, "% Paid", "WEEK 1", "WEEK 2", "WEEK 3", "WEEK 4"]);

  categorySummary.forEach((c, i) => {
    const row = cs.getRow(5 + i);
    row.values = [
      c.categoryName,
      c.totalDue.toNumber(),
      c.paid.toNumber(),
      c.pending.toNumber(),
      c.percentPaid.toNumber(),
      c.week1.toNumber(),
      c.week2.toNumber(),
      c.week3.toNumber(),
      c.week4.toNumber(),
    ];
    [2, 3, 4, 6, 7, 8, 9].forEach((n) => (row.getCell(n).numFmt = money));
    row.getCell(5).numFmt = "0.0%";
  });
  const csTotalRow = 5 + categorySummary.length;
  cs.getRow(csTotalRow).values = [
    "TOTAL",
    { formula: `SUM(B5:B${csTotalRow - 1})` },
    { formula: `SUM(C5:C${csTotalRow - 1})` },
    { formula: `SUM(D5:D${csTotalRow - 1})` },
    { formula: `IF(B${csTotalRow}=0,0,C${csTotalRow}/B${csTotalRow})` },
  ];
  cs.getRow(csTotalRow).font = { bold: true };
  [2, 3, 4].forEach((n) => (cs.getRow(csTotalRow).getCell(n).numFmt = money));
  cs.getRow(csTotalRow).getCell(5).numFmt = "0.0%";
  cs.columns = [{ width: 28 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }];

  // ── Summary (dashboard figures) ──────────────────────────────────
  const sm = wb.addWorksheet("Summary");
  sm.getCell("A1").value = `${entity.name.toUpperCase()} — SUMMARY (${currency})`;
  sm.getCell("A1").font = TITLE_FONT;
  if (range) {
    sm.getCell("A2").value = `Period: ${range.from.toISOString().slice(0, 10)} to ${range.to.toISOString().slice(0, 10)}`;
  } else {
    sm.getCell("A2").value = "Period: all time";
  }
  sm.getCell("A2").font = { size: 9, italic: true, color: { argb: "FF6B7280" } };

  const summaryRows: [string, number, string?][] = [
    ["Total Inflow (Received)", overview.totalInflowReceived.toNumber()],
    ["Total Outflow (Due)", overview.totalOutflowDue.toNumber()],
    ["Outflow Paid", overview.outflowPaid.toNumber()],
    ["Outflow Pending (Liabilities)", overview.outflowPending.toNumber()],
    ["Net Position", overview.netPosition.toNumber()],
    ["Receivables", overview.receivables.toNumber()],
    ["% Outflow Settled", overview.percentOutflowSettled.toNumber(), "pct"],
    ["Clients Closed", overview.clientsClosed, "int"],
    ["Total Deal Value Closed", inflowSummary.totalDealValue.toNumber()],
    ["Collection Rate", inflowSummary.collectionRate.toNumber(), "pct"],
    ["Average Deal Size", inflowSummary.averageDealSize.toNumber()],
  ];
  styleHeaderRow(sm, 4, ["Metric", "Value"]);
  summaryRows.forEach(([label, value, kind], i) => {
    const row = sm.getRow(5 + i);
    row.getCell(1).value = label;
    row.getCell(2).value = value;
    row.getCell(2).numFmt = kind === "pct" ? "0.0%" : kind === "int" ? "0" : money;
  });
  sm.columns = [{ width: 32 }, { width: 20 }];

  // ── Weekly Summary (only meaningful for a bounded period) ────────
  if (weekly) {
    const ws = wb.addWorksheet("Weekly Summary");
    ws.getCell("A1").value = `${entity.name.toUpperCase()} — WEEKLY SUMMARY (${currency})`;
    ws.getCell("A1").font = TITLE_FONT;
    styleHeaderRow(ws, 4, ["Week", "Items", `Total Due (${currency})`, `Paid (${currency})`, `Pending (${currency})`, "% Paid", "% of Month"]);
    weekly.weeks.forEach((w, i) => {
      const row = ws.getRow(5 + i);
      row.values = [
        `WEEK ${w.week}`,
        w.items,
        w.totalDue.toNumber(),
        w.paid.toNumber(),
        w.pending.toNumber(),
        w.percentPaid.toNumber(),
        w.percentOfMonth.toNumber(),
      ];
      [3, 4, 5].forEach((n) => (row.getCell(n).numFmt = money));
      [6, 7].forEach((n) => (row.getCell(n).numFmt = "0.0%"));
    });
    ws.columns = [{ width: 12 }, { width: 8 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 10 }, { width: 12 }];
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
