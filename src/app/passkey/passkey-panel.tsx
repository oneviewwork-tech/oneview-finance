"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Eye, EyeOff, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { setPasskey, verifyPasskey, requestPasskeyReset, confirmPasskeyReset } from "@/actions/passkey.actions";
import { PASSKEY_RULE_HINT } from "@/validators/auth";
import { OTP_LENGTH } from "@/domain/auth/otp";

// Literal colours, matching /login — this is the same standalone dark entry
// surface, not the themed product UI.
const FIELD =
  "h-12 w-full rounded-xl border border-white/10 bg-white/[0.05] pl-11 text-[15px] text-white placeholder:text-white/35 outline-none transition-colors focus:border-blue-500/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-blue-500/25";

const BUTTON =
  "h-12 w-full rounded-xl bg-blue-600 text-[15px] font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-60";

type Mode = "enter" | "create" | "reset-request" | "reset-confirm";

function ErrorNote({ message }: { message: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </p>
  );
}

export function PasskeyPanel({
  hasPasskey,
  next,
  maskedEmail,
  startInReset,
}: {
  hasPasskey: boolean;
  next: string;
  maskedEmail: string;
  startInReset: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(
    startInReset ? "reset-request" : hasPasskey ? "enter" : "create"
  );
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [pending, startTransition] = useTransition();

  // A full navigation, not router.push: the gate is enforced in the proxy,
  // which only re-evaluates on a real request. A client-side transition
  // would carry the stale "blocked" state with it.
  const onCleared = () => {
    window.location.href = next;
  };

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, onOk: () => void) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.success) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      onOk();
    });
  };

  if (mode === "reset-request") {
    return (
      <>
        <button
          type="button"
          onClick={() => { setMode(hasPasskey ? "enter" : "create"); setError(null); }}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/45 transition-colors hover:text-white/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <h1 className="text-[1.375rem] font-semibold tracking-tight text-white">Reset your passkey</h1>
        <p className="mt-1.5 text-sm text-white/50">
          We&rsquo;ll email a {OTP_LENGTH}-digit code to <span className="text-white/75">{maskedEmail}</span>.
        </p>

        <div className="mt-6 space-y-4">
          {error && <ErrorNote message={error} />}
          <button
            type="button"
            disabled={pending}
            className={BUTTON}
            onClick={() => run(() => requestPasskeyReset(), () => setMode("reset-confirm"))}
          >
            {pending ? "Sending…" : "Send code"}
          </button>
        </div>
      </>
    );
  }

  if (mode === "reset-confirm") {
    return (
      <>
        <h1 className="text-[1.375rem] font-semibold tracking-tight text-white">Enter the code</h1>
        <p className="mt-1.5 text-sm text-white/50">
          Sent to <span className="text-white/75">{maskedEmail}</span>. Then choose a new passkey.
        </p>

        <form
          className="mt-6 space-y-4"
          action={(fd) => run(() => confirmPasskeyReset(fd), onCleared)}
        >
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
            <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              name="passkey"
              type={show ? "text" : "password"}
              required
              autoComplete="new-password"
              placeholder="New passkey"
              aria-label="New passkey"
              className={`${FIELD} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide passkey" : "Show passkey"}
              aria-pressed={show}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              name="confirmPasskey"
              type={show ? "text" : "password"}
              required
              autoComplete="new-password"
              placeholder="Confirm new passkey"
              aria-label="Confirm new passkey"
              className={FIELD}
            />
          </div>
          <p className="text-xs text-white/35">{PASSKEY_RULE_HINT}</p>

          {error && <ErrorNote message={error} />}

          <button type="submit" disabled={pending} className={BUTTON}>
            {pending ? "Saving…" : "Set passkey and continue"}
          </button>
          <button
            type="button"
            onClick={() => { setMode("reset-request"); setError(null); }}
            className="w-full text-center text-sm text-white/45 transition-colors hover:text-white/80"
          >
            Didn&rsquo;t get a code? Send another
          </button>
        </form>
      </>
    );
  }

  if (mode === "create") {
    return (
      <>
        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15">
          <ShieldCheck className="h-5 w-5 text-blue-300" />
        </div>
        <h1 className="text-[1.375rem] font-semibold tracking-tight text-white">Create your passkey</h1>
        <p className="mt-1.5 text-sm text-white/50">
          A second secret, separate from your password. You&rsquo;ll enter it once each time you sign in.
        </p>

        <form className="mt-6 space-y-4" action={(fd) => run(() => setPasskey(fd), onCleared)}>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              name="passkey"
              type={show ? "text" : "password"}
              required
              autoFocus
              autoComplete="new-password"
              placeholder="Choose a passkey"
              aria-label="Passkey"
              className={`${FIELD} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide passkey" : "Show passkey"}
              aria-pressed={show}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              name="confirmPasskey"
              type={show ? "text" : "password"}
              required
              autoComplete="new-password"
              placeholder="Confirm passkey"
              aria-label="Confirm passkey"
              className={FIELD}
            />
          </div>
          <p className="text-xs text-white/35">{PASSKEY_RULE_HINT}</p>

          {error && <ErrorNote message={error} />}

          <button type="submit" disabled={pending} className={BUTTON}>
            {pending ? "Saving…" : "Create passkey and continue"}
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15">
        <ShieldCheck className="h-5 w-5 text-blue-300" />
      </div>
      <h1 className="text-[1.375rem] font-semibold tracking-tight text-white">Enter your passkey</h1>
      <p className="mt-1.5 text-sm text-white/50">This step protects financial data.</p>

      <form className="mt-6 space-y-4" action={(fd) => run(() => verifyPasskey(fd), onCleared)}>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            name="passkey"
            type={show ? "text" : "password"}
            required
            autoFocus
            autoComplete="off"
            placeholder="Passkey"
            aria-label="Passkey"
            className={`${FIELD} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide passkey" : "Show passkey"}
            aria-pressed={show}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {error && <ErrorNote message={error} />}

        <button type="submit" disabled={pending} className={BUTTON}>
          {pending ? "Checking…" : "Continue"}
        </button>
        <button
          type="button"
          onClick={() => { setMode("reset-request"); setError(null); }}
          className="w-full text-center text-sm text-white/45 transition-colors hover:text-white/80"
        >
          Forgot passkey?
        </button>
      </form>
    </>
  );
}
