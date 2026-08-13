/**
 * Proof that a session cleared the passkey gate.
 *
 * Kept in its own signed cookie rather than folded into the NextAuth JWT:
 * the proxy has to make this decision on every request at the Edge, and
 * re-minting the session token mid-flight (to flip a claim) is the kind of
 * thing that fails quietly and leaves the gate open. A separate short-lived
 * token is verifiable without touching the database or rotating the session.
 *
 * The token is bound to BOTH the user id and the login session id, so it
 * dies with the session it was issued for: signing out and back in, or a
 * session expiring, invalidates it. Copying the cookie to another session
 * doesn't work either — the sid won't match.
 *
 * Web Crypto (not node:crypto) because this must verify on the Edge runtime.
 */

export const PASSKEY_COOKIE = "ov_pk";

export interface StepUpPayload {
  /** User id the proof was issued to. */
  uid: string;
  /** Login session id it is bound to. */
  sid: string;
  /** Expiry, epoch milliseconds. */
  exp: number;
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Typed against a plain ArrayBuffer (not ArrayBufferLike) so the result
// satisfies BufferSource for crypto.subtle — a Uint8Array over a possible
// SharedArrayBuffer doesn't.
function b64urlDecode(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const s = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signStepUpToken(payload: StepUpPayload, secret: string): Promise<string> {
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(body));
  return `${body}.${b64urlEncode(new Uint8Array(sig))}`;
}

/**
 * Returns the payload only when the signature checks out AND the token has
 * not expired. Any malformed input returns null rather than throwing —
 * a corrupt cookie must read as "not verified", never as a 500 that some
 * caller might treat as a pass.
 */
export async function verifyStepUpToken(
  token: string | undefined | null,
  secret: string,
  now: number = Date.now()
): Promise<StepUpPayload | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  let ok: boolean;
  try {
    // crypto.subtle.verify is constant-time, so this doesn't leak the
    // signature through timing the way a string compare would.
    ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      b64urlDecode(sig),
      new TextEncoder().encode(body)
    );
  } catch {
    return null;
  }
  if (!ok) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as StepUpPayload;
    if (typeof payload.uid !== "string" || typeof payload.sid !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    if (payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Verifies a token belongs to this exact session. The proxy knows the user
 * and session from the JWT; a valid signature on someone else's proof must
 * not count.
 */
export async function isStepUpValidFor(
  token: string | undefined | null,
  secret: string,
  uid: string | undefined,
  sid: string | undefined,
  now: number = Date.now()
): Promise<boolean> {
  if (!uid || !sid) return false;
  const payload = await verifyStepUpToken(token, secret, now);
  return !!payload && payload.uid === uid && payload.sid === sid;
}
