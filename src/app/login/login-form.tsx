"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Lock, Mail, AlertCircle } from "lucide-react";
import { authenticate } from "./actions";

// Styled with literal colours rather than theme tokens: the login page is a
// standalone dark branded surface, not part of the themed product UI.
const FIELD =
  "h-12 w-full rounded-xl border border-white/10 bg-white/[0.05] pl-11 text-[15px] text-white placeholder:text-white/35 outline-none transition-colors focus:border-blue-500/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-blue-500/25";

export function LoginForm() {
  const [errorMessage, formAction, isPending] = useActionState(authenticate, undefined);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const checkCaps = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(e.getModifierState?.("CapsLock") ?? false);
  };

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div className="relative">
        <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input
          id="email"
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

      <div>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="Enter your password"
            aria-label="Password"
            onKeyUp={checkCaps}
            onKeyDown={checkCaps}
            aria-describedby={capsLock ? "caps-warning" : undefined}
            className={`${FIELD} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {capsLock && (
          <p id="caps-warning" role="status" aria-live="polite" className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
            Caps Lock is on
          </p>
        )}
        <div className="mt-2 text-right">
          <Link href="/forgot-password" className="text-xs text-white/45 transition-colors hover:text-white/80">
            Forgot password?
          </Link>
        </div>
      </div>

      {errorMessage && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-[15px] font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? (
          <>
            <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </button>
    </form>
  );
}
