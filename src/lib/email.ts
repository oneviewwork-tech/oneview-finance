/**
 * Transactional email, used only by the passkey reset flow.
 *
 * Two providers are supported and picked by whichever API key is present.
 * That exists because the choice turns on something outside the code: with
 * no domain to verify, Resend can only deliver to the account owner's own
 * inbox, whereas Brevo will deliver anywhere once a single sender ADDRESS
 * is confirmed by clicking a link. Supporting both means switching is an
 * environment variable rather than a code change.
 *
 * Both are called with fetch rather than an SDK: this is one POST, and a
 * dependency shipping its own HTTP stack isn't worth it. SMTP (Gmail and
 * friends) is deliberately not supported — it needs a mail library and
 * holds a connection open, which serverless functions handle poorly.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain text — an OTP has nothing to lay out, and text-only bodies are
   *  far less likely to be treated as phishing. */
  text: string;
}

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Email is not configured: set BREVO_API_KEY or RESEND_API_KEY, plus EMAIL_FROM.");
    this.name = "EmailNotConfiguredError";
  }
}

export function isEmailConfigured(): boolean {
  return !!(process.env.BREVO_API_KEY || process.env.RESEND_API_KEY) && !!process.env.EMAIL_FROM;
}

/**
 * Splits "ONEVIEW Finance <no-reply@x.co>" into its parts.
 *
 * Resend takes the combined string; Brevo wants name and email separately.
 * Falling back to treating the whole value as the address keeps a bare
 * "no-reply@x.co" working for both.
 */
export function parseFrom(value: string): { name?: string; email: string } {
  const match = /^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/.exec(value);
  if (!match) return { email: value.trim() };
  const name = match[1].replace(/^"|"$/g, "").trim();
  return { name: name || undefined, email: match[2].trim() };
}

/**
 * Sends, or throws. Callers must NOT swallow the failure and report success
 * — a passkey reset that silently fails leaves someone waiting for a mail
 * that will never arrive, with no way to tell that from a slow inbox.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const brevoKey = process.env.BREVO_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if ((!brevoKey && !resendKey) || !from) {
    // In development, log it instead of failing, so the reset flow stays
    // testable without an account. Never in production: there, a missing
    // key is a real outage and must surface as one.
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[email:dev] to=${message.to} subject="${message.subject}"\n${message.text}`);
      return;
    }
    throw new EmailNotConfiguredError();
  }

  // Brevo first when both are set: it is the one that reaches real
  // recipients without a verified domain, so if someone has configured it
  // deliberately, that is the intent.
  if (brevoKey) {
    const sender = parseFrom(from);
    await post(
      BREVO_ENDPOINT,
      { "api-key": brevoKey, "Content-Type": "application/json", accept: "application/json" },
      {
        sender: { email: sender.email, ...(sender.name ? { name: sender.name } : {}) },
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: message.text,
      },
      "Brevo"
    );
    return;
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
