/**
 * Transactional email via Resend.
 *
 * Called with fetch rather than the `resend` SDK: this is one POST, and a
 * dependency that ships its own HTTP stack isn't worth it for a single
 * endpoint that also has to work on serverless cold starts.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain text — deliberately no HTML. An OTP mail has nothing to lay out,
   *  and text-only bodies are far less likely to be treated as phishing. */
  text: string;
}

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Email is not configured: set RESEND_API_KEY and EMAIL_FROM.");
    this.name = "EmailNotConfiguredError";
  }
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

/**
 * Sends, or throws. Callers must NOT swallow the failure and report success
 * — a passkey reset that silently fails to send leaves the user waiting for
 * a mail that will never arrive, with no way to tell that from a slow inbox.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    // In development, log it instead of failing — the reset flow stays
    // testable without an account. Never in production: there, a missing
    // key is a real outage and must surface as one.
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[email:dev] to=${message.to} subject="${message.subject}"\n${message.text}`);
      return;
    }
    throw new EmailNotConfiguredError();
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }),
  });

  if (!res.ok) {
    // Body may carry the reason (unverified domain, bad key). Include it in
    // the server log, never in what the user sees.
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend rejected the message (${res.status}): ${detail.slice(0, 300)}`);
  }
}
