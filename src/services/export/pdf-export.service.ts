import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Currency } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DateRange } from "@/domain/finance/date-range";
import { columnWidths, columnOffsets, fitText, paginate, type ColumnSpec } from "@/domain/export/pdf-layout";
import { getCategorySummary, getDashboardOverview, getInflowSummary, getReceivables } from "@/services/finance/summary";
import { getAlerts } from "@/services/finance/alerts";

/**
 * A fixed-layout financial report — the thing you email to someone or file,
 * as opposed to the spreadsheet you keep working in.
 *
 * Uses pdf-lib rather than a headless browser: it's pure JS, so it runs in a
 * Vercel serverless function without bundling Chromium.
 */

const A4_LANDSCAPE: [number, number] = [841.89, 595.28];
const MARGIN = 40;
const INK = rgb(0.09, 0.09, 0.11);
const MUTED = rgb(0.42, 0.42, 0.46);
const RULE = rgb(0.85, 0.85, 0.87);
const BRAND = rgb(0.12, 0.23, 0.37);
const ROW_H = 18;
const HEADER_H = 22;

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

/**
 * pdf-lib's standard fonts are WinAnsi-encoded and throw on characters
 * outside that set — including ₹ and the en-dash this app uses freely.
 * Amounts are therefore written with an ASCII currency code ("INR 1,200.00")
 * rather than a symbol, and any stray non-WinAnsi character is stripped.
 */
function ascii(text: string): string {
  return text
    .replace(/[₹]/g, "INR ")
    .replace(/[·–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x00-\xFF]/g, "");
}

function money(amount: { toNumber(): number }, currency: Currency): string {
  const n = amount.toNumber();
  const grouped = new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `${currency} ${grouped}`;
}

function pct(value: { toNumber(): number }): string {
  return `${(value.toNumber() * 100).toFixed(1)}%`;
}

function drawTable(
  doc: PDFDocument,
  fonts: Fonts,
  opts: {
    title: string;
    headers: string[];
    specs: ColumnSpec[];
    rows: string[][];
    startPage: PDFPage;
    startY: number;
    currencyNote?: string;
  }
): { page: PDFPage; y: number } {
  const { title, headers, specs, rows, currencyNote } = opts;
  let page = opts.startPage;
  let y = opts.startY;

  const available = A4_LANDSCAPE[0] - MARGIN * 2;
  const gap = 10;
  const widths = columnWidths(specs, available, gap);
  const offsets = columnOffsets(widths, gap, MARGIN);

  const titleH = 26;
  const bottomLimit = MARGIN + 24; // leave room for the footer

  function drawHeader(p: PDFPage, atY: number): number {
    p.drawText(ascii(title), { x: MARGIN, y: atY, size: 11, font: fonts.bold, color: BRAND });
    let hy = atY - 16;
    if (currencyNote) {
      p.drawText(ascii(currencyNote), { x: MARGIN, y: hy, size: 7.5, font: fonts.regular, color: MUTED });
      hy -= 12;
    }
    headers.forEach((h, i) => {
      const text = ascii(h);
      const w = fonts.bold.widthOfTextAtSize(text, 8);
      const x = specs[i].align === "right" ? offsets[i] + widths[i] - w : offsets[i];
      p.drawText(text, { x, y: hy, size: 8, font: fonts.bold, color: MUTED });
    });
    hy -= 6;
    p.drawLine({
      start: { x: MARGIN, y: hy },
      end: { x: A4_LANDSCAPE[0] - MARGIN, y: hy },
      thickness: 0.75,
      color: RULE,
    });
    return hy - 14;
  }

  const firstPageHeight = y - bottomLimit;
  const laterPageHeight = A4_LANDSCAPE[1] - MARGIN - bottomLimit;
  const pages = paginate(rows.length, {
    firstPageHeight: firstPageHeight - titleH,
    laterPageHeight: laterPageHeight - titleH,
    rowHeight: ROW_H,
    headerHeight: HEADER_H,
  });

  pages.forEach((plan, pageIndex) => {
    if (pageIndex > 0) {
      page = doc.addPage(A4_LANDSCAPE);
      y = A4_LANDSCAPE[1] - MARGIN;
    }
    let rowY = drawHeader(page, y);

    if (plan.rows.length === 0) {
      page.drawText("No records for this period.", {
        x: MARGIN,
        y: rowY,
        size: 8.5,
        font: fonts.regular,
        color: MUTED,
      });
      rowY -= ROW_H;
    }

    for (const rowIndex of plan.rows) {
      const cells = rows[rowIndex];
      cells.forEach((cell, i) => {
        const text = ascii(cell ?? "");
        const fitted = fitText(text, widths[i], (s) => fonts.regular.widthOfTextAtSize(s, 8.5));
        const w = fonts.regular.widthOfTextAtSize(fitted, 8.5);
        const x = specs[i].align === "right" ? offsets[i] + widths[i] - w : offsets[i];
        page.drawText(fitted, { x, y: rowY, size: 8.5, font: fonts.regular, color: INK });
      });
      rowY -= ROW_H;
    }
    y = rowY - 10;
  });

  return { page, y };
}

export async function exportPdfReport(entityId: string, range?: DateRange): Promise<Buffer> {
  const entity = await prisma.businessEntity.findUniqueOrThrow({ where: { id: entityId } });
  const currency = entity.baseCurrency;

  const [overview, inflowSummary, categorySummary, receivables, alerts] = await Promise.all([
    getDashboardOverview(entityId, range),
    getInflowSummary(entityId, range),
    getCategorySummary(entityId, range),
    getReceivables(entityId, range),
    getAlerts(entityId),
  ]);

  const doc = await PDFDocument.create();
  doc.setTitle(`${entity.name} — Financial Report`);
  doc.setProducer("ONEVIEW Finance");
  doc.setCreationDate(new Date());

  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  let page = doc.addPage(A4_LANDSCAPE);
  let y = A4_LANDSCAPE[1] - MARGIN;

  // ── Title block ──────────────────────────────────────────────────
  page.drawText(ascii(`${entity.name} - Financial Report`), {
    x: MARGIN,
    y,
    size: 18,
    font: fonts.bold,
    color: BRAND,
  });
  y -= 18;
  const period = range
    ? `${range.from.toISOString().slice(0, 10)} to ${range.to.toISOString().slice(0, 10)}`
    : "All time";
  page.drawText(ascii(`Period: ${period}   |   Currency: ${currency}   |   Generated ${new Date().toISOString().slice(0, 10)}`), {
    x: MARGIN,
    y,
    size: 8.5,
    font: fonts.regular,
    color: MUTED,
  });
  y -= 22;

  // ── Headline figures, laid out as a grid of tiles ────────────────
  const tiles: [string, string][] = [
    ["Net Position", money(overview.netPosition, currency)],
    ["Total Inflow (Received)", money(overview.totalInflowReceived, currency)],
    ["Total Outflow (Due)", money(overview.totalOutflowDue, currency)],
    ["Outflow Paid", money(overview.outflowPaid, currency)],
    ["Liabilities (Pending)", money(overview.outflowPending, currency)],
    ["Receivables", money(overview.receivables, currency)],
    ["% Outflow Settled", pct(overview.percentOutflowSettled)],
    ["Clients Closed", String(overview.clientsClosed)],
  ];
  const tileW = (A4_LANDSCAPE[0] - MARGIN * 2 - 10 * 3) / 4;
  tiles.forEach(([label, value], i) => {
    const col = i % 4;
    const rowN = Math.floor(i / 4);
    const tx = MARGIN + col * (tileW + 10);
    const ty = y - rowN * 46;
    page.drawRectangle({
      x: tx,
      y: ty - 36,
      width: tileW,
      height: 38,
      borderColor: RULE,
      borderWidth: 0.75,
      color: rgb(0.985, 0.985, 0.99),
    });
    page.drawText(ascii(label), { x: tx + 8, y: ty - 12, size: 7.5, font: fonts.regular, color: MUTED });
    page.drawText(ascii(value), { x: tx + 8, y: ty - 28, size: 11, font: fonts.bold, color: INK });
  });
  y -= 46 * Math.ceil(tiles.length / 4) + 14;

  // ── Expense by category ──────────────────────────────────────────
  const activeCategories = categorySummary.filter((c) => c.totalDue.gt(0));
  ({ page, y } = drawTable(doc, fonts, {
    title: "Expense by Category",
    headers: ["Category", "Total Due", "Paid", "Pending", "% Paid"],
    specs: [{ weight: 3 }, { weight: 2, align: "right" }, { weight: 2, align: "right" }, { weight: 2, align: "right" }, { weight: 1, align: "right" }],
    rows: activeCategories.map((c) => [
      c.categoryName,
      money(c.totalDue, currency),
      money(c.paid, currency),
      money(c.pending, currency),
      pct(c.percentPaid),
    ]),
    startPage: page,
    startY: y,
  }));

  // ── Receivables ──────────────────────────────────────────────────
  ({ page, y } = drawTable(doc, fonts, {
    title: "Open Receivables",
    headers: ["Client", "Service / Project", "Deal Value", "Received", "Balance Due"],
    specs: [{ weight: 2.5 }, { weight: 3 }, { weight: 2, align: "right" }, { weight: 2, align: "right" }, { weight: 2, align: "right" }],
    rows: receivables.rows.map((r) => [
      r.clientName,
      r.description,
      money(r.dealValue, currency),
      money(r.received, currency),
      money(r.balanceDue, currency),
    ]),
    startPage: page,
    startY: y,
  }));

  // ── Ageing ───────────────────────────────────────────────────────
  ({ page, y } = drawTable(doc, fonts, {
    title: "Receivables Ageing",
    currencyNote: "Ageing covers all open items, independent of the reporting period above.",
    headers: ["Age", "Items", "Amount"],
    specs: [{ weight: 3 }, { weight: 1, align: "right" }, { weight: 2, align: "right" }],
    rows: alerts.receivablesAgeing.map((r) => [r.label, String(r.count), money(r.total, currency)]),
    startPage: page,
    startY: y,
  }));

  ({ page, y } = drawTable(doc, fonts, {
    title: "Payables Ageing",
    headers: ["Age", "Items", "Amount"],
    specs: [{ weight: 3 }, { weight: 1, align: "right" }, { weight: 2, align: "right" }],
    rows: alerts.payablesAgeing.map((r) => [r.label, String(r.count), money(r.total, currency)]),
    startPage: page,
    startY: y,
  }));

  // ── Inflow summary ───────────────────────────────────────────────
  drawTable(doc, fonts, {
    title: "Inflow Summary",
    headers: ["Metric", "Value"],
    specs: [{ weight: 3 }, { weight: 2, align: "right" }],
    rows: [
      ["Total deal value closed", money(inflowSummary.totalDealValue, currency)],
      ["Total amount received", money(inflowSummary.totalReceived, currency)],
      ["Balance receivable", money(inflowSummary.balanceReceivable, currency)],
      ["Collection rate", pct(inflowSummary.collectionRate)],
      ["New clients closed", String(inflowSummary.newClientsClosed)],
      ["Renewals / upsells / existing", String(inflowSummary.existingOrRepeatClientsClosed)],
      ["Average deal size", money(inflowSummary.averageDealSize, currency)],
      ["Total clients closed", String(inflowSummary.clientsClosed)],
    ],
    startPage: page,
    startY: y,
  });

  // ── Page numbers, added once every page exists ───────────────────
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawText(ascii(`${entity.name} - Financial Report`), {
      x: MARGIN,
      y: MARGIN - 14,
      size: 7.5,
      font: fonts.regular,
      color: MUTED,
    });
    const label = `Page ${i + 1} of ${pages.length}`;
    const w = fonts.regular.widthOfTextAtSize(label, 7.5);
    p.drawText(label, {
      x: A4_LANDSCAPE[0] - MARGIN - w,
      y: MARGIN - 14,
      size: 7.5,
      font: fonts.regular,
      color: MUTED,
    });
  });

  return Buffer.from(await doc.save());
}
