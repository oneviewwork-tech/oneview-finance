import { describe, expect, it } from "vitest";
import { validateOutflowRow } from "@/domain/import/validate-outflow";
import { validateInflowRow } from "@/domain/import/validate-inflow";
import type { ImportContext, RawInflowRow, RawOutflowRow } from "@/domain/import/types";

function context(overrides: Partial<ImportContext> = {}): ImportContext {
  return {
    periodYear: 2026,
    periodMonth: 8,
    lookups: {
      categories: new Map([["salaries & allowances", "cat-1"], ["rent & utilities", "cat-2"]]),
      expenseTypes: new Map([["current month", "type-1"], ["old dues / arrears", "type-2"]]),
      paymentMethods: new Map([["bank transfer", "pm-1"], ["cash", "pm-2"]]),
      clientTypes: new Map([["new client", "ct-1"], ["existing client", "ct-2"]]),
    },
    ...overrides,
  };
}

function outflowRow(overrides: Partial<RawOutflowRow> = {}): RawOutflowRow {
  return {
    rowNumber: 9,
    week: "WEEK 1",
    expenseItem: "Base Salary",
    category: "Salaries & Allowances",
    type: "Current Month",
    amountDue: "27840",
    amountPaid: null,
    payFull: "Y",
    datePaid: null,
    mode: "Bank Transfer",
    referenceNo: null,
    remarks: null,
    ...overrides,
  };
}

describe("validateOutflowRow", () => {
  it("accepts a fully-paid row (Pay Full = Y) and computes amountPaid = amountDue", () => {
    const result = validateOutflowRow(outflowRow(), context());
    expect(result.kind).toBe("valid");
    if (result.kind === "valid") {
      expect(result.row.amountPaid.toString()).toBe("27840");
      expect(result.row.status).toBe("PAID");
      expect(result.row.transactionDate.toISOString()).toBe("2026-08-01T00:00:00.000Z"); // WEEK 1 -> day 1
    }
  });

  it("skips a genuinely blank template row rather than reporting it as an error", () => {
    const result = validateOutflowRow(
      outflowRow({ expenseItem: null, amountDue: null, week: null, category: null, type: null, payFull: null, mode: null }),
      context()
    );
    expect(result.kind).toBe("skipped");
  });

  it("computes a partial payment from Amount Paid when Pay Full is not Y", () => {
    const result = validateOutflowRow(outflowRow({ payFull: "N", amountDue: "15000", amountPaid: "10000" }), context());
    expect(result.kind).toBe("valid");
    if (result.kind === "valid") {
      expect(result.row.amountPaid.toString()).toBe("10000");
      expect(result.row.status).toBe("PARTIAL");
    }
  });

  it("treats a blank Amount Paid as pending, not an error", () => {
    const result = validateOutflowRow(outflowRow({ payFull: "N", amountPaid: null }), context());
    expect(result.kind).toBe("valid");
    if (result.kind === "valid") {
      expect(result.row.amountPaid.toString()).toBe("0");
      expect(result.row.status).toBe("PENDING");
    }
  });

  it("rejects Amount Paid greater than Amount Due", () => {
    const result = validateOutflowRow(outflowRow({ payFull: "N", amountDue: "1000", amountPaid: "1500" }), context());
    expect(result.kind).toBe("invalid");
  });

  it("flags an unknown category rather than silently creating one", () => {
    const result = validateOutflowRow(outflowRow({ category: "Made Up Category" }), context());
    expect(result.kind).toBe("invalid");
    if (result.kind === "invalid") {
      expect(result.errors.some((e) => e.field === "category" && e.message.includes("Unknown category"))).toBe(true);
    }
  });

  it("flags an unknown expense type", () => {
    const result = validateOutflowRow(outflowRow({ type: "Not A Real Type" }), context());
    expect(result.kind).toBe("invalid");
  });

  it("flags an unrecognized week label", () => {
    const result = validateOutflowRow(outflowRow({ week: "WEEK 9" }), context());
    expect(result.kind).toBe("invalid");
  });

  it("maps WEEK 3 to day 15 of the given period month/year", () => {
    const result = validateOutflowRow(outflowRow({ week: "Week 3" }), context({ periodYear: 2026, periodMonth: 8 }));
    expect(result.kind).toBe("valid");
    if (result.kind === "valid") expect(result.row.transactionDate.toISOString()).toBe("2026-08-15T00:00:00.000Z");
  });
});

describe("validateInflowRow", () => {
  function inflowRow(overrides: Partial<RawInflowRow> = {}): RawInflowRow {
    return {
      rowNumber: 6,
      dateReceived: "05-Aug-26",
      clientName: "Gulf Retail LLC",
      serviceProject: "SMM Retainer — 6 months",
      clientType: "New Client",
      dealValue: "30000",
      amountReceived: "15000",
      paymentMode: "Bank Transfer",
      referenceNo: null,
      closedBy: "Aswin KP",
      remarks: null,
      ...overrides,
    };
  }

  it("accepts a valid partial-receipt row and parses the Zoho date format", () => {
    const result = validateInflowRow(inflowRow(), context());
    expect(result.kind).toBe("valid");
    if (result.kind === "valid") {
      expect(result.row.transactionDate.toISOString()).toBe("2026-08-05T00:00:00.000Z");
      expect(result.row.amountReceived.toString()).toBe("15000");
      expect(result.row.status).toBe("PARTIAL");
    }
  });

  it("also accepts a real JS Date object for the date cell (exceljs auto-detection)", () => {
    const result = validateInflowRow(inflowRow({ dateReceived: new Date(Date.UTC(2026, 7, 5)) }), context());
    expect(result.kind).toBe("valid");
    if (result.kind === "valid") expect(result.row.transactionDate.toISOString()).toBe("2026-08-05T00:00:00.000Z");
  });

  it("skips a genuinely blank template row", () => {
    const result = validateInflowRow(inflowRow({ clientName: null, dealValue: null }), context());
    expect(result.kind).toBe("skipped");
  });

  it("treats a blank Amount Received as zero (PENDING), not an error", () => {
    const result = validateInflowRow(inflowRow({ amountReceived: null }), context());
    expect(result.kind).toBe("valid");
    if (result.kind === "valid") {
      expect(result.row.amountReceived.toString()).toBe("0");
      expect(result.row.status).toBe("PENDING");
    }
  });

  it("rejects Amount Received greater than Deal Value", () => {
    const result = validateInflowRow(inflowRow({ dealValue: "10000", amountReceived: "20000" }), context());
    expect(result.kind).toBe("invalid");
  });

  it("flags an unknown client type", () => {
    const result = validateInflowRow(inflowRow({ clientType: "Not A Real Type" }), context());
    expect(result.kind).toBe("invalid");
  });

  it("flags a missing/invalid Date Received", () => {
    const result = validateInflowRow(inflowRow({ dateReceived: null }), context());
    expect(result.kind).toBe("invalid");
  });
});
