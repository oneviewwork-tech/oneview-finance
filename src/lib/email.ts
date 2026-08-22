/**
 * Transactional email, used only by the passkey reset flow.
 *
 * Sent via Resend over fetch rather than an SDK: this is one POST, and a
 * dependency shipping its own HTTP stack isn't worth it. SMTP (Gmail and
 * friends) is deliberately not supported — it needs a mail library and
 * holds a connection open, which serverless functions handle poorly.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain text — an OTP has nothing to lay out, and text-only bodies are
   *  far less likely to be treated as phishing. */
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
 * — a passkey reset that silently fails leaves someone waiting for a mail
 * that will never arrive, with no way to tell that from a slow inbox.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!resendKey || !from) {
    // In development, log it instead of failing, so the reset flow stays
    // testable without an account. Never in production: there, a missing
    // key is a real outage and must surface as one.
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[email:dev] to=${message.to} subject="${message.subject}"\n${message.text}`);
      return;
    }
    throw new EmailNotConfiguredError();
  }

  await post(
    RESEND_ENDPOINT,
    { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    { from, to: [message.to], subject: message.subject, text: message.text },
    "Resend"
  );
}

async function post(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  provider: string
): Promise<void> {
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    // The body carries the reason (unverified sender, bad key). It belongs
    // in the server log, never in what the user is shown.
    const detail = await res.text().catch(() => "");
    throw new Error(`${provider} rejected the message (${res.status}): ${detail.slice(0, 300)}`);
  }
}
