import { describe, expect, it } from "vitest";
import { csvField, csvRow, toCsv, csvFilename } from "@/domain/export/csv";

describe("csvField", () => {
  it("leaves simple values untouched", () => {
    expect(csvField("Salaries")).toBe("Salaries");
    expect(csvField(1500)).toBe("1500");
  });

  it("returns an empty string for null/undefined rather than 'null'", () => {
    expect(csvField(null)).toBe("");
    expect(csvField(undefined)).toBe("");
  });

  it("quotes and escapes commas, quotes and newlines", () => {
    expect(csvField("Rent, August")).toBe('"Rent, August"');
    expect(csvField('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("quotes values with leading/trailing whitespace so it survives the round trip", () => {
    expect(csvField("  padded  ")).toBe('"  padded  "');
  });

  // The important one: these open as live formulas in Excel/Sheets.
  it("neutralises formula injection", () => {
    expect(csvField("=1+1")).toBe("'=1+1");
    expect(csvField("+SUM(A1)")).toBe("'+SUM(A1)");
    expect(csvField("-2+3")).toBe("'-2+3");
    expect(csvField("@import")).toBe("'@import");
    expect(csvField('=HYPERLINK("http://evil","x")')).toBe(`"'=HYPERLINK(""http://evil"",""x"")"`);
  });

  it("does not mangle a negative number written as a number", () => {
    // Numbers are stringified first, so -5 hits the same guard as "-5".
    // Prefixing keeps Excel from evaluating it, which is the safer default
    // for a text CSV; amounts are exported pre-formatted as strings anyway.
    expect(csvField(-5)).toBe("'-5");
  });
});

describe("csvRow / toCsv", () => {
  it("joins fields with commas", () => {
    expect(csvRow(["a", "b,c", 1])).toBe('a,"b,c",1');
  });

  it("emits a BOM and CRLF line endings so Excel reads UTF-8 correctly", () => {
    const csv = toCsv(["Name", "Amount"], [["Rent", "₹1,000"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("\r\n");
    expect(csv).toBe("﻿Name,Amount\r\nRent,\"₹1,000\"\r\n");
  });

  it("handles zero rows without producing a stray blank line", () => {
    expect(toCsv(["A"], [])).toBe("﻿A\r\n");
  });
});

describe("csvFilename", () => {
  it("slugifies parts and stamps the date", () => {
    const d = new Date(Date.UTC(2026, 7, 12));
    expect(csvFilename(["UAE", "Outflow"], d)).toBe("uae-outflow-2026-08-12.csv");
  });

  it("strips characters that would break a download or a path", () => {
    const d = new Date(Date.UTC(2026, 0, 5));
    expect(csvFilename(["India / Inflow", "This Month"], d)).toBe("india-inflow-this-month-2026-01-05.csv");
  });
});
