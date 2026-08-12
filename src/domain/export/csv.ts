/**
 * Minimal RFC 4180 CSV serialisation.
 *
 * Pure and dependency-free so it can be unit tested directly, and so the
 * export path never pulls a parser library into the bundle just to *write*
 * a format this simple.
 */

/**
 * Quotes a single field.
 *
 * Two things matter beyond the RFC:
 *
 * 1. A field containing `"` , `,` , newline, or leading/trailing spaces must
 *    be quoted, with inner quotes doubled.
 * 2. CSV injection: a field starting with `=`, `+`, `-`, `@`, tab or CR is
 *    interpreted as a formula by Excel/Sheets. Financial exports get opened
 *    in exactly those tools, so such values are prefixed with a single
 *    quote. This is the same defence OWASP recommends; without it a
 *    description like `=HYPERLINK(...)` becomes live on open.
 */
export function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text = typeof value === "string" ? value : String(value);

  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  if (/[",\n\r]/.test(text) || text !== text.trim()) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function csvRow(values: readonly unknown[]): string {
  return values.map(csvField).join(",");
}

/**
 * Serialises rows to a CSV document.
 *
 * CRLF line endings and a UTF-8 BOM are deliberate: without the BOM Excel
 * on Windows misreads UTF-8 (₹ and ₨ render as mojibake), which matters
 * because every amount in this app can carry a currency symbol.
 */
export function toCsv(headers: readonly string[], rows: readonly (readonly unknown[])[]): string {
  const lines = [csvRow(headers), ...rows.map(csvRow)];
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Safe, descriptive download filename — no spaces or path separators. */
export function csvFilename(parts: readonly string[], date: Date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10);
  const slug = parts
    .map((p) => p.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean)
    .join("-");
  return `${slug}-${stamp}.csv`;
}
