/** Best-effort client IP from proxy headers — for audit logging only, never for security decisions (headers are trivially spoofable by the client itself; only trustworthy once behind a proxy that overwrites them). */
export function getClientIp(headers: Headers): string | null {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? null;
  return headers.get("x-real-ip");
}
