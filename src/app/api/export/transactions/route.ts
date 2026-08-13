import { NextResponse, type NextRequest } from "next/server";
import type { TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireEntityAccess, ForbiddenError, UnauthenticatedError } from "@/lib/rbac";
import { writeAuditEvent } from "@/lib/audit";
import { parseRangeSelection, resolveSelection, describeSelection } from "@/domain/finance/date-range";
import { csvFilename } from "@/domain/export/csv";
import { exportTransactionsCsv } from "@/services/export/transaction-export.service";
import { exportWorkbook } from "@/services/export/workbook-export.service";
import { exportPdfReport } from "@/services/export/pdf-export.service";

/**
 * Export download for a single entity, in CSV, Excel or PDF.
 *
 * A route handler rather than a Server Action because the browser has to
 * receive a file with Content-Disposition; Server Actions return RSC
 * payloads, not downloads.
 *
 * Entity-scoped RBAC applies exactly as it does in the UI — a UAE finance
 * user cannot export India's data by editing the query string — and every
 * successful export is written to the audit log, since bulk extraction of
 * financial records is precisely the action you want a record of.
 *
 * `type` (INFLOW/OUTFLOW) only applies to CSV, which is a single-table
 * format. The workbook and the PDF both cover the whole entity, so they
 * ignore it rather than pretending to honour it.
 */

const FORMATS = ["csv", "xlsx", "pdf"] as const;
type ExportFormat = (typeof FORMATS)[number];

const CONTENT_TYPE: Record<ExportFormat, string> = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const entityId = params.get("entityId");
  const formatParam = (params.get("format") ?? "csv").toLowerCase();

  if (!entityId) {
    return NextResponse.json({ error: "entityId is required" }, { status: 400 });
  }
  if (!FORMATS.includes(formatParam as ExportFormat)) {
    return NextResponse.json({ error: `format must be one of: ${FORMATS.join(", ")}` }, { status: 400 });
  }
  const format = formatParam as ExportFormat;

  const typeParam = (params.get("type") ?? "").toUpperCase();
  if (format === "csv" && typeParam !== "INFLOW" && typeParam !== "OUTFLOW") {
    return NextResponse.json({ error: "type must be INFLOW or OUTFLOW for a CSV export" }, { status: 400 });
  }
  const transactionType = typeParam as TransactionType;

  const entity = await prisma.businessEntity.findUnique({ where: { id: entityId } });
  if (!entity) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  let actor;
  try {
    actor = await requireEntityAccess(entity.code);
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  // No range params at all means "export everything". This is deliberately
  // NOT routed through parseRangeSelection: that helper falls back to
  // THIS_MONTH for anything it doesn't recognise, which would quietly turn a
  // full export into a one-month one.
  const hasRangeParams = ["range", "month", "from", "to"].some((k) => params.get(k));

  const selection = hasRangeParams
    ? parseRangeSelection({
        range: params.get("range") ?? undefined,
        month: params.get("month") ?? undefined,
        from: params.get("from") ?? undefined,
        to: params.get("to") ?? undefined,
      })
    : null;
  const range = selection ? resolveSelection(selection) : undefined;
  const periodLabel = selection ? describeSelection(selection) : "all-time";

  let body: Buffer | string;
  let filename: string;

  if (format === "csv") {
    body = await exportTransactionsCsv(entity.id, transactionType, range);
    filename = csvFilename([entity.code, transactionType, periodLabel]);
  } else if (format === "xlsx") {
    body = await exportWorkbook(entity.id, range);
    filename = csvFilename([entity.code, "workbook", periodLabel]).replace(/\.csv$/, ".xlsx");
  } else {
    body = await exportPdfReport(entity.id, range);
    filename = csvFilename([entity.code, "report", periodLabel]).replace(/\.csv$/, ".pdf");
  }

  await writeAuditEvent(prisma, {
    entityType: "FinancialTransaction",
    entityId: entity.id,
    action: "EXPORT",
    actorUserId: actor.id,
    actorEmail: actor.email,
    metadata: {
      format,
      // Only meaningful for CSV; recorded as null elsewhere so the log
      // doesn't imply a filter that wasn't applied.
      transactionType: format === "csv" ? transactionType : null,
      entityCode: entity.code,
      range: range ? { from: range.from.toISOString(), to: range.to.toISOString() } : "ALL_TIME",
      filename,
    },
  });

  return new NextResponse(body as BodyInit, {
    headers: {
      "Content-Type": CONTENT_TYPE[format],
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Financial data — never let a shared cache hold onto this.
      "Cache-Control": "private, no-store",
    },
  });
}
