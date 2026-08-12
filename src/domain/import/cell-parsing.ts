import type { RawCellValue } from "./types";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function cellToText(value: RawCellValue): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return null;
  const str = String(value).trim();
  return str === "" ? null : str;
}

/** Handles both a real JS Date (exceljs auto-detects date-formatted cells) and Zoho's common "05-Aug-26" text format. */
export function cellToDate(value: RawCellValue): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }
  const str = String(value).trim();
  if (str === "") return null;

  const match = /^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/.exec(str);
  if (match) {
    const [, day, monStr, yearStr] = match;
    const monthIndex = MONTHS.indexOf(monStr.toLowerCase());
    if (monthIndex === -1) return null;
    let year = Number(yearStr);
    if (year < 100) year += 2000;
    return new Date(Date.UTC(year, monthIndex, Number(day)));
  }

  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Strips thousands separators; returns null (not "0") for anything that isn't a plain decimal number, so callers can tell "blank" from "garbage." */
export function cellToDecimalString(value: RawCellValue): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return null;
  const str = String(value).trim().replace(/,/g, "");
  if (str === "") return null;
  return /^-?\d+(\.\d+)?$/.test(str) ? str : null;
}
