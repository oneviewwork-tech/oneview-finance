import { describe, expect, it } from "vitest";
import {
  generateOtp,
  isWellFormedOtp,
  otpExpiry,
  otpStateRejection,
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
} from "@/domain/auth/otp";

describe("generateOtp", () => {
  it("always produces exactly the declared number of digits", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateOtp();
      expect(code).toHaveLength(OTP_LENGTH);
      expect(/^\d+$/.test(code)).toBe(true);
    }
  });

  // Leading zeros are a classic off-by-one: a numeric code rendered without
  // padding produces a 5-digit string the user can't enter.
  it("pads short values rather than dropping leading zeros", () => {
    const codes = Array.from({ length: 2000 }, () => generateOtp());
    expect(codes.every((c) => c.length === OTP_LENGTH)).toBe(true);
  });

  it("does not repeat itself trivially", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateOtp()));
    // 200 draws from a million values should essentially never collide more
    // than a handful of times; anything near-constant means a broken RNG.
    expect(codes.size).toBeGreaterThan(190);
  });
});

describe("isWellFormedOtp", () => {
  it("accepts exactly six digits", () => {
    expect(isWellFormedOtp("012345")).toBe(true);
  });

  it("rejects anything else", () => {
    for (const bad of ["", "12345", "1234567", "12 345", "12-345", "abcdef", "12345a", " 123456"]) {
      expect(isWellFormedOtp(bad)).toBe(false);
    }
  });
});

describe("otpStateRejection", () => {
  const future = new Date(Date.now() + 60_000);
  const past = new Date(Date.now() - 1);

  it("accepts a fresh unused code", () => {
    expect(otpStateRejection({ expiresAt: future, consumedAt: null, attempts: 0 })).toBeNull();
  });

  it("rejects a spent code", () => {
    expect(otpStateRejection({ expiresAt: future, consumedAt: new Date(), attempts: 0 })).toBe("consumed");
  });

  it("rejects an expired code", () => {
    expect(otpStateRejection({ expiresAt: past, consumedAt: null, attempts: 0 })).toBe("expired");
  });

  it("rejects once the attempt budget is spent", () => {
    expect(otpStateRejection({ expiresAt: future, consumedAt: null, attempts: OTP_MAX_ATTEMPTS })).toBe(
      "too_many_attempts"
    );
  });

  // Being spent outranks being expired: reporting "expired" for a code that
  // was already used would invite a retry that can never succeed.
  it("reports consumption ahead of expiry", () => {
    expect(otpStateRejection({ expiresAt: past, consumedAt: new Date(), attempts: 0 })).toBe("consumed");
  });

  it("treats the expiry instant as expired", () => {
    const now = new Date();
    expect(otpStateRejection({ expiresAt: now, consumedAt: null, attempts: 0 }, now)).toBe("expired");
  });
});

describe("otpExpiry", () => {
  it("sits exactly one TTL ahead", () => {
    const now = new Date("2026-08-13T10:00:00Z");
    expect(otpExpiry(now).getTime() - now.getTime()).toBe(OTP_TTL_MS);
  });
});
