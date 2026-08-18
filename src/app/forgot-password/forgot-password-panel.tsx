"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Lock, Mail } from "lucide-react";
import { requestPasswordReset, confirmPasswordReset } from "@/actions/password-reset.actions";
import { PASSWORD_RULE_HINT, PASSWORD_RESET_GENERIC_MESSAGE } from "@/validators/auth";
import { OTP_LENGTH } from "@/domain/auth/otp";

// Literal colours, matching /login — this is the same standalone dark entry
// surface, not the themed product UI.
const FIELD =
  "h-12 w-full rounded-xl border border-white/10 bg-white/[0.05] pl-11 text-[15px] text-white placeholder:text-white/35 outline-none transition-colors focus:border-blue-500/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-blue-500/25";

const BUTTON =
  "h-12 w-full rounded-xl bg-blue-600 text-[15px] font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-60";

type Mode = "request" | "confirm" | "done";

function ErrorNote({ message }: { message: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </p>
  );
}

/**
 * Reset the login password with no session at all — that's the case this
 * exists for, unlike /passkey's reset which runs for someone already signed
 * in. Deliberately generic on the request step: the response, and the
 * screen shown next, are identical whether or not the typed email belongs
 * to a real account, so this page can't be used to find out who has one.
 */
export function ForgotPasswordPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("request");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [pending, startTransition] = useTransition();

  function submitRequest(formData: FormData) {
    setError(null);
    const typed = String(formData.get("email") ?? "");
    startTransition(async () => {
      const result = await requestPasswordReset(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      // The typed email is carried to the confirm step as a plain field —
      // this page never learns from the server whether it matched a real
      // account, so there's nothing to leak here either.
      setEmail(typed);
      setMode("confirm");
    });
  }

  function submitConfirm(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await confirmPasswordReset(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMode("done");
    });
  }

  if (mode === "done") {
    return (
      <>
        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15">
          <CheckCircle2 className="h-5 w-5 text-emerald-300" />
        </div>
        <h1 className="text-[1.375rem] font-semibold tracking-tight text-white">Password updated</h1>
        <p className="mt-1.5 text-sm text-white/50">Sign in with your new password.</p>
        <button type="button" onClick={() => router.push("/login")} className={`${BUTTON} mt-6`}>
          Back to sign in
        </button>
      </>
    );
  }

  if (mode === "confirm") {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setMode("request");
            setError(null);
          }}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/45 transition-colors hover:text-white/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <h1 className="text-[1.375rem] font-semibold tracking-tight text-white">Enter the code</h1>
        <p className="mt-1.5 text-sm text-white/50">{PASSWORD_RESET_GENERIC_MESSAGE}</p>

        <form action={submitConfirm} className="mt-6 space-y-4">
          <input type="hidden" name="email" value={email} />

          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_LENGTH}
              required
              autoFocus
              placeholder={`${OTP_LENGTH}-digit code`}
              aria-label="Reset code"
              className={`${FIELD} tracking-[0.3em]`}
            />
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              name="newPassword"
              type={show ? "text" : "password"}
              required
              autoComplete="new-password"
              placeholder="New password"
              aria-label="New password"
              className={`${FIELD} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide password" : "Show password"}
              aria-pressed={show}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              name="confirmPassword"
              type={show ? "text" : "password"}
              required
              autoComplete="new-password"
              placeholder="Confirm new password"
              aria-label="Confirm new password"
              className={FIELD}
            />
          </div>
          <p className="text-xs text-white/35">{PASSWORD_RULE_HINT}</p>

          {error && <ErrorNote message={error} />}

          <button type="submit" disabled={pending} className={BUTTON}>
            {pending ? "Saving…" : "Set new password"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("request");
              setError(null);
            }}
            className="w-full text-center text-sm text-white/45 transition-colors hover:text-white/80"
          >
            Didn&rsquo;t get a code? Send another
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15">
        <KeyRound className="h-5 w-5 text-blue-300" />
      </div>
      <h1 className="text-[1.375rem] font-semibold tracking-tight text-white">Forgot password</h1>
      <p className="mt-1.5 text-sm text-white/50">We&rsquo;ll email a {OTP_LENGTH}-digit code to reset it.</p>

      <form action={submitRequest} className="mt-6 space-y-4">
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            name="email"
            type="email"
            required
            autoFocus
            autoComplete="username"
            placeholder="Enter your email"
            aria-label="Email"
            className={FIELD}
          />
        </div>

        {error && <ErrorNote message={error} />}

        <button type="submit" disabled={pending} className={BUTTON}>
          {pending ? "Sending…" : "Send code"}
        </button>
        <Link
          href="/login"
          className="block w-full text-center text-sm text-white/45 transition-colors hover:text-white/80"
        >
          Back to sign in
        </Link>
      </form>
    </>
  );
}
