/**
 * One-time codes for passkey reset.
 *
 * Pure rules, no I/O — the decisions here (is it expired, is it spent, has
 * it been guessed at too often) are exactly the ones that must not be
 * subtly wrong, so they're testable without a database.
 */

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const OTP_MAX_ATTEMPTS = 5;
/** How long a completed reset stays usable before the user must start over. */
export const RESET_WINDOW_MS = 15 * 60 * 1000;

export interface OtpRecord {
  expiresAt: Date;
  consumedAt: Date | null;
  attempts: number;
}

export type OtpRejection = "expired" | "consumed" | "too_many_attempts" | "mismatch";

/**
 * Why a code can't be accepted — independent of whether the digits match,
 * so the caller checks state before spending effort comparing hashes.
 */
export function otpStateRejection(record: OtpRecord, now: Date = new Date()): OtpRejection | null {
  if (record.consumedAt) return "consumed";
  if (record.attempts >= OTP_MAX_ATTEMPTS) return "too_many_attempts";
  if (record.expiresAt <= now) return "expired";
  return null;
}

/**
 * Six digits, uniformly distributed, from a CSPRNG.
 *
 * Rejection sampling rather than `% 1000000`: the modulo of a 32-bit value
 * is biased toward low codes, which is a real (if small) advantage to a
 * guesser and costs nothing to avoid.
 */
export function generateOtp(): string {
  const max = 10 ** OTP_LENGTH;
  const limit = Math.floor(0xffffffff / max) * max;
  const buf = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= limit);
  return String(value % max).padStart(OTP_LENGTH, "0");
}

/** Digits only, exactly OTP_LENGTH — rejects spaces, dashes and pasted junk. */
export function isWellFormedOtp(value: string): boolean {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(value);
}

export function otpExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + OTP_TTL_MS);
}

/** Minutes remaining, for the "expires in N minutes" line in the email. */
export function otpTtlMinutes(): number {
  return Math.round(OTP_TTL_MS / 60000);
}
