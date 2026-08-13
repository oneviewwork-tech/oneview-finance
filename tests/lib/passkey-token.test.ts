import { describe, expect, it } from "vitest";
import { signStepUpToken, verifyStepUpToken, isStepUpValidFor } from "@/lib/passkey-token";

const SECRET = "test-secret-value-for-hmac-signing";
const OTHER_SECRET = "a-different-secret-entirely";

function payload(over: Partial<{ uid: string; sid: string; exp: number }> = {}) {
  return { uid: "user_1", sid: "session_1", exp: Date.now() + 60_000, ...over };
}

describe("step-up token", () => {
  it("round-trips a valid proof", async () => {
    const token = await signStepUpToken(payload(), SECRET);
    const decoded = await verifyStepUpToken(token, SECRET);
    expect(decoded?.uid).toBe("user_1");
    expect(decoded?.sid).toBe("session_1");
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signStepUpToken(payload(), OTHER_SECRET);
    expect(await verifyStepUpToken(token, SECRET)).toBeNull();
  });

  // The whole point of signing: editing the payload must invalidate it.
  it("rejects a tampered payload", async () => {
    const token = await signStepUpToken(payload(), SECRET);
    const [body, sig] = token.split(".");
    const forged = btoa(JSON.stringify({ uid: "admin", sid: "session_1", exp: Date.now() + 60_000 }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(body).not.toBe(forged);
    expect(await verifyStepUpToken(`${forged}.${sig}`, SECRET)).toBeNull();
  });

  it("rejects an expired proof", async () => {
    const token = await signStepUpToken(payload({ exp: Date.now() - 1 }), SECRET);
    expect(await verifyStepUpToken(token, SECRET)).toBeNull();
  });

  it("expires exactly at the boundary rather than a moment after", async () => {
    const exp = Date.now() + 1000;
    const token = await signStepUpToken(payload({ exp }), SECRET);
    expect(await verifyStepUpToken(token, SECRET, exp - 1)).not.toBeNull();
    expect(await verifyStepUpToken(token, SECRET, exp)).toBeNull();
  });

  // A corrupt cookie must read as "not verified" — never throw, since a
  // caller treating a thrown error as anything but a failure would open
  // the gate.
  it("returns null for malformed input instead of throwing", async () => {
    for (const bad of ["", "nodot", ".", "a.", ".b", "!!!.???", "a.b.c"]) {
      expect(await verifyStepUpToken(bad, SECRET)).toBeNull();
    }
    expect(await verifyStepUpToken(undefined, SECRET)).toBeNull();
    expect(await verifyStepUpToken(null, SECRET)).toBeNull();
  });

  it("rejects a well-signed token whose payload is the wrong shape", async () => {
    const body = btoa(JSON.stringify({ uid: 1, sid: [], exp: "soon" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
    let s = "";
    for (const b of sigBytes) s += String.fromCharCode(b);
    const sig = btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(await verifyStepUpToken(`${body}.${sig}`, SECRET)).toBeNull();
  });
});

describe("isStepUpValidFor", () => {
  it("accepts a proof bound to the same user and session", async () => {
    const token = await signStepUpToken(payload(), SECRET);
    expect(await isStepUpValidFor(token, SECRET, "user_1", "session_1")).toBe(true);
  });

  // Replaying someone else's cookie, or your own from a previous login,
  // must not clear the gate.
  it("rejects a proof from another session or another user", async () => {
    const token = await signStepUpToken(payload(), SECRET);
    expect(await isStepUpValidFor(token, SECRET, "user_1", "session_2")).toBe(false);
    expect(await isStepUpValidFor(token, SECRET, "user_2", "session_1")).toBe(false);
  });

  it("fails closed when the session is unknown", async () => {
    const token = await signStepUpToken(payload(), SECRET);
    expect(await isStepUpValidFor(token, SECRET, undefined, "session_1")).toBe(false);
    expect(await isStepUpValidFor(token, SECRET, "user_1", undefined)).toBe(false);
  });

  // A missing AUTH_SECRET is what the proxy passes as "". Web Crypto refuses
  // a zero-length key outright, so this can only ever fail — the point is
  // that it fails CLOSED (false), not by throwing, which a caller might
  // mishandle into an open gate.
  it("fails closed when the signing secret is missing", async () => {
    const token = await signStepUpToken(payload(), SECRET);
    await expect(isStepUpValidFor(token, "", "user_1", "session_1")).resolves.toBe(false);
  });

  // ...and it cannot be used to mint one either, so there is no way to
  // produce a proof that an empty-secret verifier would accept.
  it("cannot sign with an empty secret at all", async () => {
    await expect(signStepUpToken(payload(), "")).rejects.toThrow();
  });
});
