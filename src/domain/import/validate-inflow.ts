import { Prisma } from "@prisma/client";
import { calculateStatus, wouldOverpay } from "@/domain/finance/calculations";
import { cellToDate, cellToDecimalString, cellToText } from "./cell-parsing";
import type { ImportContext, ImportRowError, RawInflowRow, ValidatedInflowRow } from "./types";

const { Decimal } = Prisma;

export type InflowValidationResult =
  | { kind: "valid"; row: ValidatedInflowRow }
  | { kind: "skipped" }
  | { kind: "invalid"; errors: ImportRowError[] };

export function validateInflowRow(raw: RawInflowRow, context: ImportContext): InflowValidationResult {
  const clientName = cellToText(raw.clientName);
  const dealValueRaw = cellToDecimalString(raw.dealValue);

  if (!clientName && !dealValueRaw) {
    return { kind: "skipped" };
  }

  const errors: ImportRowError[] = [];

  if (!clientName) {
    errors.push({ rowNumber: raw.rowNumber, field: "clientName", message: "Client Name is required" });
  }
  if (!dealValueRaw) {
    errors.push({ rowNumber: raw.rowNumber, field: "dealValue", message: "Deal Value is missing or not a valid number" });
  }

  const transactionDate = cellToDate(raw.dateReceived);
  if (!transactionDate) {
    errors.push({ rowNumber: raw.rowNumber, field: "dateReceived", message: "Date Received is missing or not a valid date" });
  }

  const serviceProject = cellToText(raw.serviceProject);

  const clientTypeText = cellToText(raw.clientType);
  const clientTypeId = clientTypeText ? context.lookups.clientTypes.get(clientTypeText.toLowerCase()) : undefined;
  if (clientTypeText && !clientTypeId) {
    errors.push({
      rowNumber: raw.rowNumber,
      field: "clientType",
      message: `Unknown client type "${clientTypeText}" — add it in Master Data first or fix the spelling`,
    });
  }

  const amountReceivedRaw = cellToDecimalString(raw.amountReceived);
  if (raw.amountReceived && amountReceivedRaw === null && cellToText(raw.amountReceived)) {
    errors.push({ rowNumber: raw.rowNumber, field: "amountReceived", message: "Amount Received is not a valid number" });
  }

  const modeText = cellToText(raw.paymentMode);
  const paymentMethodId = modeText ? context.lookups.paymentMethods.get(modeText.toLowerCase()) : undefined;
  if (modeText && !paymentMethodId) {
    errors.push({ rowNumber: raw.rowNumber, field: "paymentMode", message: `Unknown payment mode "${modeText}"` });
  }

  if (errors.length > 0 || !dealValueRaw || !transactionDate) {
    return { kind: "invalid", errors };
  }

  const dealValue = new Decimal(dealValueRaw);
  const amountReceived = amountReceivedRaw ? new Decimal(amountReceivedRaw) : new Decimal(0);

  if (wouldOverpay(dealValue, new Decimal(0), amountReceived)) {
    return {
      kind: "invalid",
      errors: [{ rowNumber: raw.rowNumber, field: "amountReceived", message: "Amount Received exceeds Deal Value" }],
    };
  }

  return {
    kind: "valid",
    row: {
      rowNumber: raw.rowNumber,
      transactionDate,
      description: serviceProject ?? clientName!,
      clientName: clientName!,
      clientTypeId: clientTypeId ?? null,
      clientTypeName: clientTypeText,
      dealValue,
      amountReceived,
      status: calculateStatus(dealValue, amountReceived),
      paymentMethodId: paymentMethodId ?? null,
      referenceNumber: cellToText(raw.referenceNo),
      closedByName: cellToText(raw.closedBy),
      remarks: cellToText(raw.remarks),
    },
  };
}
